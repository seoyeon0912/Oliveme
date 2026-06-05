const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const productFile = path.join(__dirname, '..', 'products.json');

function readProducts() {
    if (!fs.existsSync(productFile)) return [];
    const data = fs.readFileSync(productFile, 'utf8');
    return data ? JSON.parse(data) : [];
}

// 제품 상세 페이지
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const products = readProducts();
    // id 타입 맞춰서 비교
    const product = products.find(p => String(p.id) === String(id));
    if (!product) return res.status(404).send('상품을 찾을 수 없습니다.');

    res.render('product', {
        product,
        session: req.session,
        isAdmin: req.session?.isAdmin === true
    });
});

module.exports = router;
