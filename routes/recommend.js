const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');

const API_KEY = '85d43b79691d005ac516a45010e2c7d9';
const CITY = 'Hwaseong';

//  JSON 상품 목록 로드
const productList = JSON.parse(fs.readFileSync('products.json', 'utf-8'));

router.get('/', async (req, res) => {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${API_KEY}&units=metric&lang=kr`;
    const response = await axios.get(url);
    const weatherData = response.data;

    const weather = weatherData.weather[0].main;
    const temp = weatherData.main.temp;

    let weatherMessage = '';
    let productRecommendation = '';
    let selectedProduct = null;

    if (weather === 'Clear') {
      weatherMessage = '오늘은 해가 쨍쨍한 맑은 날이에요 ☀️';
      productRecommendation = '자외선이 강하니 촉촉한 선크림을 추천합니다!';
      selectedProduct = productList.find(p => p.name.includes('선크림')) || productList[0];
    } else if (weather === 'Rain') {
      weatherMessage = '오늘은 비 오는 날이에요 🌧️';
      productRecommendation = '비가 와도 지워지지 않는 워터프루프 마스카라 추천드려요!';
      selectedProduct = productList.find(p => p.name.includes('마스카라')) || productList[0];
    } else if (weather === 'Clouds') {
      weatherMessage = '오늘은 흐림 ☁️';
      productRecommendation = '수분크림으로 피부 장벽을 지켜요!';
      selectedProduct = productList.find(p => p.name.includes('수분크림')) || productList[0];
    } else if (weather === 'Snow') {
      weatherMessage = '눈 오는 날이에요 ❄️';
      productRecommendation = '건조한 날씨엔 립밤이 최고!';
      selectedProduct = productList.find(p => p.name.includes('립밤')) || productList[0];
    } else {
      weatherMessage = `현재 날씨: ${weather}`;
      productRecommendation = '기본 메이크업 제품을 추천드립니다!';
      selectedProduct = productList[0];
    }

    const recommended = selectedProduct.name;

    res.render('recommend', {
      weatherMessage,
      productRecommendation,
      selectedProduct,
      recommended,
      weather: weatherData.weather[0].description,
      temp
    });

  } catch (err) {
    console.error(err);
    res.render('recommend', {
      weatherMessage: '날씨 정보를 불러오는 데 실패했어요 😥',
      productRecommendation: '일단 립밤이라도 바르고 힘내요!',
      selectedProduct: productList[0],
      recommended: productList[0].name,
      weather: '정보 없음',
      temp: '-'
    });
  }
});

module.exports = router;
