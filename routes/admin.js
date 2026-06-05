const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const productsFile = path.join(__dirname, '..', 'products.json');


function isAdminLoggedIn(req, res, next) {
    if (req.session && req.session.isAdmin) {
    next();
    } else {
    res.redirect('/admin/login');
    }
}

// 로그인 페이지
router.get('/login', (req, res) => {
res.render('admin_login');
});

// 로그인 처리
router.post('/login', (req, res) => {
const { username, password } = req.body;
if (username === 'admin' && password === 'admin123') {
    req.session.isAdmin = true;
    res.redirect('/admin');
} else {
    res.send('<script>alert("아이디 또는 비밀번호가 틀렸습니다."); history.back();</script>');
}
});

// 로그아웃
router.get('/logout', (req, res) => {
req.session.destroy(() => {
    res.redirect('/admin/login');
});
});

// 관리자 페이지 - 상품 목록 및 추가
router.get('/', isAdminLoggedIn, (req, res) => {
const products = JSON.parse(fs.readFileSync(productsFile, 'utf-8'));
res.render('admin', { products });
});

// 상품 추가
router.post('/add', isAdminLoggedIn, (req, res) => {
const { name, price } = req.body;
const products = JSON.parse(fs.readFileSync(productsFile, 'utf-8'));
const newId = products.length > 0 ? String(Number(products[products.length - 1].id) + 1) : '1';

products.push({
    id: newId,
    name,
    price: Number(price),
    image: 'default.png',
    description: '',
});

fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
res.redirect('/admin');
});

// 상품 삭제
router.post('/delete/:id', isAdminLoggedIn, (req, res) => {
    const id = req.params.id;
    let products = JSON.parse(fs.readFileSync(productsFile, 'utf-8'));
    products = products.filter((p) => p.id !== id);
    fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
    res.redirect('/admin');
});

// 상품 수정 페이지
router.get('/edit/:id', isAdminLoggedIn, (req, res) => {
    const id = req.params.id;
    const products = JSON.parse(fs.readFileSync(productsFile, 'utf-8'));
    const product = products.find((p) => p.id === id);
    if (!product) return res.status(404).send('상품을 찾을 수 없습니다.');
    res.render('admin_edit', { product });
});

// 상품 수정 처리
router.post('/edit/:id', isAdminLoggedIn, (req, res) => {
const id = req.params.id;
const { name, price, image, description } = req.body;
const products = JSON.parse(fs.readFileSync(productsFile, 'utf-8'));
const idx = products.findIndex((p) => p.id === id);
if (idx === -1) return res.status(404).send('상품을 찾을 수 없습니다.');

products[idx].name = name;
products[idx].price = Number(price);
products[idx].image = image;
products[idx].description = description;

fs.writeFileSync(productsFile, JSON.stringify(products, null, 2));
res.redirect('/admin');
});

module.exports = router;
