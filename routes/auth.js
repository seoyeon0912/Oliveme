const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const transporter = require('../config/mailer');

const userFile = path.join(__dirname, '..', 'users.json');
const ordersFile = path.join(__dirname, '..', 'orders.json');
const cartFile = path.join(__dirname, '..', 'carts.json');

function readUsers() {
    if (!fs.existsSync(userFile)) return [];
    const data = fs.readFileSync(userFile, 'utf8');
    return data ? JSON.parse(data) : [];
}

function writeUsers(users) {
    fs.writeFileSync(userFile, JSON.stringify(users, null, 2));
}

function readOrders() {
    if (!fs.existsSync(ordersFile)) return [];
    const data = fs.readFileSync(ordersFile, 'utf8');
    return data ? JSON.parse(data) : [];
}

function writeOrders(orders) {
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
}

function readCart() {
    if (!fs.existsSync(cartFile)) return [];
    const data = fs.readFileSync(cartFile, 'utf8');
    return data ? JSON.parse(data) : [];
}

function writeCart(cart) {
    fs.writeFileSync(cartFile, JSON.stringify(cart, null, 2));
}

function isStrongPassword(password) {
    const isLongEnough = password.length >= 12;
    const hasUppercase = /[A-Z]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    return isLongEnough && hasUppercase && hasSpecial;
}

function createAuthCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendAuthCode(email, authCode) {
    await transporter.sendMail({
        from: `"OliveMe" <${process.env.MAIL_USER}>`,
        to: email,
        subject: '[OliveMe] 로그인 2차 인증번호',
        html: `
            <h2>OliveMe 로그인 2차 인증</h2>
            <p>아래 인증번호를 입력해주세요.</p>
            <h1>${authCode}</h1>
            <p>인증번호는 10분 동안만 유효합니다.</p>
        `
    });
}

async function sendRegisterAuthCode(email, authCode) {
    await transporter.sendMail({
        from: `"OliveMe" <${process.env.MAIL_USER}>`,
        to: email,
        subject: '[OliveMe] 회원가입 이메일 인증번호',
        html: `
            <h2>OliveMe 회원가입 이메일 인증</h2>
            <p>아래 인증번호를 회원가입 화면에 입력해주세요.</p>
            <h1>${authCode}</h1>
            <p>인증번호는 10분 동안만 유효합니다.</p>
        `
    });
}

async function sendResetPasswordCode(email, authCode) {
    await transporter.sendMail({
        from: `"OliveMe" <${process.env.MAIL_USER}>`,
        to: email,
        subject: '[OliveMe] 비밀번호 재설정 인증번호',
        html: `
            <h2>OliveMe 비밀번호 재설정</h2>
            <p>아래 인증번호를 입력해주세요.</p>
            <h1>${authCode}</h1>
            <p>인증번호는 10분 동안만 유효합니다.</p>
        `
    });
}

async function sendProfileEmailChangeCode(email, authCode) {
    await transporter.sendMail({
        from: `"OliveMe" <${process.env.MAIL_USER}>`,
        to: email,
        subject: '[OliveMe] 개인정보 이메일 변경 인증번호',
        html: `
            <h2>OliveMe 이메일 변경 인증</h2>
            <p>개인정보 수정 화면에 아래 인증번호를 입력해주세요.</p>
            <h1>${authCode}</h1>
            <p>인증번호는 10분 동안만 유효합니다.</p>
        `
    });
}

/* 로그인 페이지 */
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

/* 로그인 처리 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const users = readUsers();

    const userIndex = users.findIndex(u => u.username === username);
    const user = users[userIndex];

    if (!user) {
        return res.render('login', {
            error: '존재하지 않는 사용자입니다.'
        });
    }

    const now = Date.now();

    if (user.lockUntil && now < user.lockUntil) {
        const remainMinutes = Math.ceil((user.lockUntil - now) / 1000 / 60);

        return res.render('login', {
            error: `비밀번호를 5회 이상 틀려 계정이 잠겼습니다. ${remainMinutes}분 뒤 다시 시도해주세요.`
        });
    }

    const isMatch = bcrypt.compareSync(password, user.password);

    if (!isMatch) {
        users[userIndex].loginFailCount = (users[userIndex].loginFailCount || 0) + 1;

        if (users[userIndex].loginFailCount >= 5) {
            users[userIndex].lockUntil = now + 10 * 60 * 1000;
            users[userIndex].loginFailCount = 0;
            writeUsers(users);

            return res.render('login', {
                error: '비밀번호를 5회 이상 틀렸습니다. 10분 뒤 다시 로그인할 수 있습니다.'
            });
        }

        writeUsers(users);

        return res.render('login', {
            error: `비밀번호가 틀렸습니다. (${users[userIndex].loginFailCount}/5회)`
        });
    }

    users[userIndex].loginFailCount = 0;
    users[userIndex].lockUntil = null;
    writeUsers(users);

    if (!user.email) {
        return res.render('login', {
            error: '이메일이 등록되지 않은 계정입니다. 다시 회원가입해주세요.'
        });
    }

    const authCode = createAuthCode();

    req.session.tempUser = {
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin === true
    };

    req.session.authCode = authCode;
    req.session.authCodeExpires = Date.now() + 10 * 60 * 1000;

    try {
        await sendAuthCode(user.email, authCode);
        res.redirect('/verify');
    } catch (err) {
        console.error('이메일 전송 실패 상세:', err);

        res.render('login', {
            error: '인증번호 이메일 전송에 실패했습니다.'
        });
    }
});

/* 2차 인증 페이지 */
router.get('/verify', (req, res) => {
    if (!req.session.tempUser) {
        return res.redirect('/login');
    }

    if (!req.session.authCodeExpires) {
        req.session.authCodeExpires = Date.now() + 10 * 60 * 1000;
    }

    res.render('verify', {
        error: null,
        expiresAt: req.session.authCodeExpires
    });
});

/* 2차 인증 처리 */
router.post('/verify', (req, res) => {
    const { code } = req.body;

    if (!req.session.tempUser) {
        return res.redirect('/login');
    }

    if (!req.session.authCodeExpires) {
        req.session.authCodeExpires = Date.now() + 10 * 60 * 1000;
    }

    if (Date.now() > req.session.authCodeExpires) {
        return res.render('verify', {
            error: '인증번호가 만료되었습니다. 코드 재전송을 눌러주세요.',
            expiresAt: 0
        });
    }

    if (code !== req.session.authCode) {
        return res.render('verify', {
            error: '인증번호가 일치하지 않습니다.',
            expiresAt: req.session.authCodeExpires
        });
    }

    req.session.username = req.session.tempUser.username;
    req.session.isAdmin = req.session.tempUser.isAdmin;

    delete req.session.tempUser;
    delete req.session.authCode;
    delete req.session.authCodeExpires;

    if (req.session.isAdmin) {
        return res.redirect('/admin');
    }

    res.redirect('/');
});

/* 인증번호 재전송 */
router.post('/resend-code', async (req, res) => {
    if (!req.session.tempUser) {
        return res.json({
            success: false,
            message: '인증 세션이 만료되었습니다. 다시 로그인해주세요.'
        });
    }

    const newCode = createAuthCode();

    req.session.authCode = newCode;
    req.session.authCodeExpires = Date.now() + 10 * 60 * 1000;

    try {
        await sendAuthCode(req.session.tempUser.email, newCode);

        res.json({
            success: true,
            message: '인증번호가 재전송되었습니다.',
            expiresAt: req.session.authCodeExpires
        });
    } catch (err) {
        console.error('인증번호 재전송 실패:', err);

        res.json({
            success: false,
            message: '인증번호 재전송에 실패했습니다.'
        });
    }
});

/* 회원가입 페이지 */
router.get('/register', (req, res) => {
    res.render('register', { error: null });
});

/* 회원가입 이메일 인증번호 전송 */
router.post('/register/send-code', async (req, res) => {
    const { username, email } = req.body;
    const users = readUsers();

    if (!username || !email) {
        return res.json({
            success: false,
            message: '아이디와 이메일을 모두 입력해주세요.'
        });
    }

    if (users.find(u => u.username === username)) {
        return res.json({
            success: false,
            message: '이미 존재하는 사용자입니다.'
        });
    }

    if (users.find(u => u.email === email)) {
        return res.json({
            success: false,
            message: '이미 사용 중인 이메일입니다.'
        });
    }

    const registerAuthCode = createAuthCode();

    req.session.registerAuth = {
        username,
        email,
        code: registerAuthCode,
        expires: Date.now() + 10 * 60 * 1000
    };

    try {
        await sendRegisterAuthCode(email, registerAuthCode);

        res.json({
            success: true,
            message: '회원가입 인증번호가 이메일로 전송되었습니다.'
        });
    } catch (err) {
        console.error('회원가입 인증번호 전송 실패:', err);

        res.json({
            success: false,
            message: '인증번호 이메일 전송에 실패했습니다.'
        });
    }
});

/* 회원가입 처리 */
router.post('/register', (req, res) => {
    const { username, email, password, confirmPassword, registerAuthCode } = req.body;
    const users = readUsers();

    if (users.find(u => u.username === username)) {
        return res.render('register', {
            error: '이미 존재하는 사용자입니다.'
        });
    }

    if (users.find(u => u.email === email)) {
        return res.render('register', {
            error: '이미 사용 중인 이메일입니다.'
        });
    }

    if (!req.session.registerAuth) {
        return res.render('register', {
            error: '이메일 인증을 먼저 진행해주세요.'
        });
    }

    if (
        req.session.registerAuth.username !== username ||
        req.session.registerAuth.email !== email
    ) {
        return res.render('register', {
            error: '인증받은 아이디/이메일과 현재 입력값이 다릅니다. 인증번호를 다시 받아주세요.'
        });
    }

    if (Date.now() > req.session.registerAuth.expires) {
        delete req.session.registerAuth;

        return res.render('register', {
            error: '회원가입 인증번호가 만료되었습니다. 다시 인증번호를 받아주세요.'
        });
    }

    if (registerAuthCode !== req.session.registerAuth.code) {
        return res.render('register', {
            error: '회원가입 인증번호가 일치하지 않습니다.'
        });
    }

    if (password !== confirmPassword) {
        return res.render('register', {
            error: '비밀번호와 비밀번호 확인이 일치하지 않습니다.'
        });
    }

    if (!isStrongPassword(password)) {
        return res.render('register', {
            error: '비밀번호는 12자 이상이며, 영어 대문자와 특수문자를 포함해야 합니다.'
        });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    users.push({
        username,
        email,
        password: hashedPassword,
        cart: [],
        isAdmin: false,
        name: '',
        phone: '',
        receiver: '',
        deliveryPhone: '',
        zipcode: '',
        address: '',
        detailAddress: '',
        loginFailCount: 0,
        lockUntil: null
    });

    writeUsers(users);

    delete req.session.registerAuth;

    return res.send(`
        <script>
            alert("회원가입이 완료되었습니다.");
            window.location.href = "/login";
        </script>
    `);
});

/* 아이디 찾기 페이지 */
router.get('/find-id', (req, res) => {
    res.render('find_id', {
        error: null,
        success: null
    });
});

/* 아이디 찾기 처리 */
router.post('/find-id', (req, res) => {
    const { email } = req.body;
    const users = readUsers();

    const user = users.find(u => u.email === email);

    if (!user) {
        return res.render('find_id', {
            error: '해당 이메일로 가입된 계정이 없습니다.',
            success: null
        });
    }

    res.render('find_id', {
        error: null,
        success: `가입된 아이디는 "${user.username}" 입니다.`
    });
});

/* 비밀번호 찾기 페이지 */
router.get('/forgot-password', (req, res) => {
    res.render('forgot_password', {
        error: null,
        success: null
    });
});

/* 비밀번호 찾기 처리 */
router.post('/forgot-password', async (req, res) => {
    const { username, email } = req.body;
    const users = readUsers();

    const user = users.find(u => u.username === username && u.email === email);

    if (!user) {
        return res.render('forgot_password', {
            error: '아이디 또는 이메일이 일치하지 않습니다.',
            success: null
        });
    }

    const resetCode = createAuthCode();

    req.session.resetPasswordUser = {
        username: user.username,
        email: user.email
    };

    req.session.resetPasswordCode = resetCode;
    req.session.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    req.session.resetPasswordVerified = false;

    try {
        await sendResetPasswordCode(user.email, resetCode);
        res.redirect('/reset-password');
    } catch (err) {
        console.error('비밀번호 재설정 이메일 전송 실패:', err);

        res.render('forgot_password', {
            error: '인증번호 이메일 전송에 실패했습니다.',
            success: null
        });
    }
});

/* 비밀번호 재설정 페이지 */
router.get('/reset-password', (req, res) => {
    if (!req.session.resetPasswordUser) {
        return res.redirect('/forgot-password');
    }

    res.render('reset_password', {
        error: null,
        success: null,
        step: req.session.resetPasswordVerified ? 'reset' : 'verify'
    });
});

/* 비밀번호 재설정 인증번호 확인 */
router.post('/reset-password/verify', (req, res) => {
    const { code } = req.body;

    if (!req.session.resetPasswordUser) {
        return res.redirect('/forgot-password');
    }

    if (Date.now() > req.session.resetPasswordExpires) {
        delete req.session.resetPasswordUser;
        delete req.session.resetPasswordCode;
        delete req.session.resetPasswordExpires;
        delete req.session.resetPasswordVerified;

        return res.render('forgot_password', {
            error: '인증번호가 만료되었습니다. 다시 비밀번호 찾기를 진행해주세요.',
            success: null
        });
    }

    if (code !== req.session.resetPasswordCode) {
        return res.render('reset_password', {
            error: '인증번호가 일치하지 않습니다.',
            success: null,
            step: 'verify'
        });
    }

    req.session.resetPasswordVerified = true;

    res.render('reset_password', {
        error: null,
        success: '인증이 완료되었습니다. 새 비밀번호를 입력해주세요.',
        step: 'reset'
    });
});

/* 새 비밀번호 저장 */
router.post('/reset-password', (req, res) => {
    const { password, passwordConfirm } = req.body;

    if (!req.session.resetPasswordUser || !req.session.resetPasswordVerified) {
        return res.redirect('/forgot-password');
    }

    if (password !== passwordConfirm) {
        return res.render('reset_password', {
            error: '새 비밀번호와 비밀번호 확인이 일치하지 않습니다.',
            success: null,
            step: 'reset'
        });
    }

    if (!isStrongPassword(password)) {
        return res.render('reset_password', {
            error: '비밀번호는 12자 이상이며, 영어 대문자와 특수문자를 포함해야 합니다.',
            success: null,
            step: 'reset'
        });
    }

    const users = readUsers();

    const userIndex = users.findIndex(
        u => u.username === req.session.resetPasswordUser.username
    );

    if (userIndex === -1) {
        return res.redirect('/forgot-password');
    }

    users[userIndex].password = bcrypt.hashSync(password, 10);
    users[userIndex].loginFailCount = 0;
    users[userIndex].lockUntil = null;

    writeUsers(users);

    delete req.session.resetPasswordUser;
    delete req.session.resetPasswordCode;
    delete req.session.resetPasswordExpires;
    delete req.session.resetPasswordVerified;

    res.render('login', {
        error: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.'
    });
});

/* 마이페이지 */
router.get('/mypage', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    const users = readUsers();
    const user = users.find(u => u.username === req.session.username);

    if (!user) {
        return res.redirect('/login');
    }

    const orders = readOrders();
    const userOrders = orders.filter(order => order.username === req.session.username);

    res.render('mypage', {
        user,
        orders: userOrders
    });
});

/* 개인정보 수정 페이지 */
router.get('/profile-edit', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    const users = readUsers();
    const user = users.find(u => u.username === req.session.username);

    if (!user) {
        return res.redirect('/login');
    }

    res.render('profile_edit', {
        user,
        error: null,
        success: null
    });
});

/* 개인정보 수정 이메일 인증번호 전송 */
router.post('/profile-edit/send-code', async (req, res) => {
    if (!req.session.username) {
        return res.json({
            success: false,
            message: '로그인이 필요합니다.'
        });
    }

    const { email } = req.body;
    const users = readUsers();
    const currentUser = users.find(u => u.username === req.session.username);

    if (!currentUser) {
        return res.json({
            success: false,
            message: '사용자 정보를 찾을 수 없습니다.'
        });
    }

    if (!email) {
        return res.json({
            success: false,
            message: '이메일을 입력해주세요.'
        });
    }

    if (email === currentUser.email) {
        return res.json({
            success: false,
            message: '현재 사용 중인 이메일과 동일합니다. 이메일 인증 없이 수정할 수 있습니다.'
        });
    }

    if (users.find(u => u.email === email && u.username !== req.session.username)) {
        return res.json({
            success: false,
            message: '이미 사용 중인 이메일입니다.'
        });
    }

    const profileEmailCode = createAuthCode();

    req.session.profileEmailChange = {
        email,
        code: profileEmailCode,
        expires: Date.now() + 10 * 60 * 1000,
        verified: false
    };

    try {
        await sendProfileEmailChangeCode(email, profileEmailCode);

        res.json({
            success: true,
            message: '새 이메일로 인증번호가 전송되었습니다.'
        });
    } catch (err) {
        console.error('개인정보 이메일 변경 인증번호 전송 실패:', err);

        res.json({
            success: false,
            message: '인증번호 이메일 전송에 실패했습니다.'
        });
    }
});

/* 개인정보 수정 이메일 인증번호 확인 */
router.post('/profile-edit/verify-code', (req, res) => {
    if (!req.session.username) {
        return res.json({
            success: false,
            message: '로그인이 필요합니다.'
        });
    }

    const { email, code } = req.body;

    if (!req.session.profileEmailChange) {
        return res.json({
            success: false,
            message: '먼저 인증번호를 받아주세요.'
        });
    }

    if (email !== req.session.profileEmailChange.email) {
        return res.json({
            success: false,
            message: '인증번호를 받은 이메일과 현재 입력한 이메일이 다릅니다.'
        });
    }

    if (Date.now() > req.session.profileEmailChange.expires) {
        delete req.session.profileEmailChange;

        return res.json({
            success: false,
            message: '인증번호가 만료되었습니다. 다시 인증번호를 받아주세요.'
        });
    }

    if (code !== req.session.profileEmailChange.code) {
        return res.json({
            success: false,
            message: '인증번호가 일치하지 않습니다.'
        });
    }

    req.session.profileEmailChange.verified = true;

    res.json({
        success: true,
        message: '이메일 인증이 완료되었습니다.'
    });
});

/* 개인정보 수정 처리 */
router.post('/profile-edit', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    const { name, phone, email } = req.body;
    const users = readUsers();

    const userIndex = users.findIndex(u => u.username === req.session.username);

    if (userIndex === -1) {
        return res.redirect('/login');
    }

    const currentEmail = users[userIndex].email;
    const isEmailChanged = email !== currentEmail;

    const existingEmail = users.find(
        u => u.email === email && u.username !== req.session.username
    );

    if (existingEmail) {
        return res.render('profile_edit', {
            user: users[userIndex],
            error: '이미 사용 중인 이메일입니다.',
            success: null
        });
    }

    if (isEmailChanged) {
        if (
            !req.session.profileEmailChange ||
            req.session.profileEmailChange.email !== email ||
            req.session.profileEmailChange.verified !== true
        ) {
            return res.render('profile_edit', {
                user: {
                    ...users[userIndex],
                    name,
                    phone,
                    email
                },
                error: '이메일을 변경하려면 새 이메일 인증을 완료해주세요.',
                success: null
            });
        }

        if (Date.now() > req.session.profileEmailChange.expires) {
            delete req.session.profileEmailChange;

            return res.render('profile_edit', {
                user: {
                    ...users[userIndex],
                    name,
                    phone,
                    email
                },
                error: '이메일 인증 시간이 만료되었습니다. 다시 인증해주세요.',
                success: null
            });
        }
    }

    users[userIndex].name = name;
    users[userIndex].phone = phone;
    users[userIndex].email = email;

    writeUsers(users);

    delete req.session.profileEmailChange;

    res.render('profile_edit', {
        user: users[userIndex],
        error: null,
        success: '개인정보가 수정되었습니다.'
    });
});

/* 배송지 관리 페이지 */
router.get('/address', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    const users = readUsers();
    const user = users.find(u => u.username === req.session.username);

    if (!user) {
        return res.redirect('/login');
    }

    res.render('address', {
        user,
        success: null
    });
});

/* 배송지 저장 처리 */
router.post('/address', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    const { receiver, phone, zipcode, address, detailAddress } = req.body;
    const users = readUsers();

    const userIndex = users.findIndex(u => u.username === req.session.username);

    if (userIndex === -1) {
        return res.redirect('/login');
    }

    users[userIndex].receiver = receiver;
    users[userIndex].deliveryPhone = phone;
    users[userIndex].zipcode = zipcode;
    users[userIndex].address = address;
    users[userIndex].detailAddress = detailAddress;

    writeUsers(users);

    res.render('address', {
        user: users[userIndex],
        success: '배송지 정보가 저장되었습니다.'
    });
});

/* 회원탈퇴 페이지 */
router.get('/delete-account', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    res.render('delete_account', {
        error: null
    });
});

/* 회원탈퇴 처리 */
router.post('/delete-account', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }

    const { password } = req.body;
    const username = req.session.username;

    const users = readUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
        req.session.destroy(() => {
            res.redirect('/login');
        });
        return;
    }

    const isMatch = bcrypt.compareSync(password, user.password);

    if (!isMatch) {
        return res.render('delete_account', {
            error: '비밀번호가 일치하지 않습니다.'
        });
    }

    const updatedUsers = users.filter(u => u.username !== username);
    writeUsers(updatedUsers);

    const orders = readOrders();
    const updatedOrders = orders.filter(order => order.username !== username);
    writeOrders(updatedOrders);

    const cart = readCart();
    const updatedCart = cart.filter(item => item.user !== username);
    writeCart(updatedCart);

    req.session.destroy(() => {
        res.redirect('/');
    });
});

/* 로그아웃 */
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

module.exports = router;