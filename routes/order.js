const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const ordersFile = path.join(__dirname, '..', 'orders.json');
const cartFile = path.join(__dirname, '..', 'carts.json');
const productsFile = path.join(__dirname, '..', 'products.json');

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

function readProducts() {
    if (!fs.existsSync(productsFile)) return [];

    const data = fs.readFileSync(productsFile, 'utf8');
    return data ? JSON.parse(data) : [];
}

function normalizeQuantity(quantity) {
    const parsedQuantity = parseInt(quantity, 10);

    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
        return 1;
    }

    return parsedQuantity;
}

// 주문하기
router.post('/checkout', (req, res) => {
    const username = req.session.username;

    if (!username) {
        return res.redirect('/login');
    }

    const cart = readCart();
    const products = readProducts();

    const userCart = cart.filter(item => item.user === username);

    if (userCart.length === 0) {
        return res.redirect('/cart');
    }

    const orderItems = userCart.map(item => {
        const product = products.find(p => p.id === item.id);

        const name = product ? product.name : item.name;
        const price = product ? product.price : item.price;
        const image = product ? product.image : item.image;
        const quantity = normalizeQuantity(item.quantity);

        return {
            id: item.id,
            name,
            price,
            image,
            quantity,
            subtotal: price * quantity
        };
    });

    const totalPrice = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

    const newOrder = {
        username,
        items: orderItems,
        totalPrice,
        time: new Date().toLocaleString()
    };

    const orders = readOrders();
    orders.push(newOrder);
    writeOrders(orders);

    const updatedCart = cart.filter(item => item.user !== username);
    writeCart(updatedCart);

    req.session.cart = [];

    res.render('order_done', {
        order: newOrder
    });
});

// 주문 내역 페이지
router.get('/list', (req, res) => {
    const username = req.session.username;

    if (!username) {
        return res.redirect('/login');
    }

    const orders = readOrders();
    const userOrders = orders.filter(order => order.username === username);

    res.render('orders', {
        orders: userOrders
    });
});

module.exports = router;