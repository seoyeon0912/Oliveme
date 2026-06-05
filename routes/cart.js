const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const cartFile = path.join(__dirname, '..', 'carts.json');
const productFile = path.join(__dirname, '..', 'products.json');

// 장바구니 읽기
function readCart() {
    if (!fs.existsSync(cartFile)) return [];

    const data = fs.readFileSync(cartFile, 'utf8');
    return data ? JSON.parse(data) : [];
}

// 장바구니 저장
function writeCart(cart) {
    fs.writeFileSync(cartFile, JSON.stringify(cart, null, 2));
}

// 상품 읽기
function readProducts() {
    if (!fs.existsSync(productFile)) return [];

    const data = fs.readFileSync(productFile, 'utf8');
    return data ? JSON.parse(data) : [];
}

// 수량 정리
function normalizeQuantity(quantity) {
    const parsedQuantity = parseInt(quantity, 10);

    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
        return 1;
    }

    return parsedQuantity;
}

// 장바구니 페이지
router.get('/', (req, res) => {
    const username = req.session.username;

    if (!username) {
        return res.redirect('/login');
    }

    const cart = readCart();
    const products = readProducts();

    const userCart = cart
        .filter(item => item.user === username)
        .map(item => {
            const product = products.find(p => p.id === item.id);

            if (!product) {
                return null;
            }

            return {
                ...product,
                quantity: normalizeQuantity(item.quantity)
            };
        })
        .filter(item => item !== null);

    res.render('cart', {
        cart: userCart
    });
});

// 상품 장바구니에 추가
router.post('/add', (req, res) => {
    const username = req.session.username;

    if (!username) {
        return res.redirect('/login');
    }

    const { id, quantity } = req.body;
    const addQuantity = normalizeQuantity(quantity);

    const products = readProducts();
    const product = products.find(p => p.id === id);

    if (!product) {
        return res.redirect('/');
    }

    const cart = readCart();
    const existing = cart.find(item => item.user === username && item.id === id);

    if (existing) {
        existing.quantity = normalizeQuantity(existing.quantity) + addQuantity;
    } else {
        cart.push({
            user: username,
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: addQuantity
        });
    }

    writeCart(cart);

    res.redirect('/cart');
});

// 수량 수정
router.post('/update', (req, res) => {
    const username = req.session.username;

    if (!username) {
        return res.redirect('/login');
    }

    const { id, quantity } = req.body;
    const updateQuantity = normalizeQuantity(quantity);

    const cart = readCart();

    cart.forEach(item => {
        if (item.user === username && item.id === id) {
            item.quantity = updateQuantity;
        }
    });

    writeCart(cart);

    res.redirect('/cart');
});

// 상품 삭제
router.post('/delete', (req, res) => {
    const username = req.session.username;

    if (!username) {
        return res.redirect('/login');
    }

    const { id } = req.body;
    let cart = readCart();

    cart = cart.filter(item => !(item.user === username && item.id === id));

    writeCart(cart);

    res.redirect('/cart');
});

module.exports = router;