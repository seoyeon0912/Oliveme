require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();

const authRouter = require('./routes/auth');
const cartRouter = require('./routes/cart');
const recommendRouter = require('./routes/recommend');
const adminRouter = require('./routes/admin');
const productRouter = require('./routes/product');
const orderRouter = require('./routes/order');

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.use(session({
    secret: 'olive_secret',
    resave: false,
    saveUninitialized: true
}));

app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

app.get('/', (req, res) => {
    const productsPath = path.join(__dirname, 'products.json');
    const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    res.render('index', { products });
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.use('/cart', cartRouter);
app.use('/recommend', recommendRouter);
app.use('/admin', adminRouter);
app.use('/product', productRouter);
app.use('/order', orderRouter);
app.use('/', authRouter);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
    console.log('MAIL_USER:', process.env.MAIL_USER || '없음');
    console.log('MAIL_PASS:', process.env.MAIL_PASS ? '있음' : '없음');

    if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
        console.log('⚠️ .env 파일의 MAIL_USER 또는 MAIL_PASS가 제대로 설정되지 않았습니다.');
        console.log('⚠️ .env 위치가 프로젝트 최상위인지 확인하세요.');
        console.log('⚠️ MAIL_PASS는 구글 앱 비밀번호 16자리를 공백 없이 입력해야 합니다.');
    }
});