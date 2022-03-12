const express = require('express');
const { body } = require('express-validator');

const adminController = require('../controllers/admin');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

router.get('/products', isAuth, adminController.getProducts);

router.get('/add-product', isAuth, adminController.getAddProduct);
router.post(
  '/add-product',
  body('title')
    .isString()
    .isLength({ min: 3, max: 50 })
    .trim()
    .withMessage('Title must be 3-50 characters'),
  body('price')
    .isFloat()
    .withMessage('Price must be a number with 2 optional decimal places'),
  body('description')
    .isLength({ min: 3, max: 400 })
    .trim()
    .withMessage('Description must be 3 - 400 characters'),
  isAuth,
  adminController.postAddProduct
);

router.get('/edit-product/:productId', isAuth, adminController.getEditProduct);
router.post(
  '/edit-product',
  body('title')
    .isString()
    .isLength({ min: 3, max: 50 })
    .trim()
    .withMessage('Title must be 3-50 characters'),
  body('price')
    .isFloat()
    .withMessage('Price must be a number with 2 optional decimal places'),
  body('description')
    .isLength({ min: 3, max: 400 })
    .trim()
    .withMessage('Description must be 3 - 400 characters'),
  isAuth,
  adminController.postEditProduct
);

router.delete('/product/:productId', isAuth, adminController.deleteProduct);

module.exports = router;
