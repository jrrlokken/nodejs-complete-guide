const express = require('express');
const { body } = require('express-validator');

const authController = require('../controllers/auth');
const User = require('../models/user');

const router = express.Router();

router.get('/signup', authController.getSignup);
router.post(
  '/signup',
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .custom((value, { req }) => {
      return User.findOne({ email: value }).then((userDoc) => {
        if (userDoc) {
          return Promise.reject('Account exists with that email');
        }
      });
    })
    .normalizeEmail(),
  body('password', 'Password must be at least 8 characters')
    .isLength({
      min: 8,
    })
    .trim(),
  body('confirmPassword')
    .trim()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords must match');
      }
      return true;
    }),
  authController.postSignup
);

router.get('/login', authController.getLogin);
router.post(
  '/login',
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  body('password', 'Password must be at least 8 characters')
    .isLength({
      min: 8,
    })
    .trim(),
  authController.postLogin
);

router.post('/logout', authController.postLogout);

router.get('/reset', authController.getReset);
router.post('/reset', authController.postReset);

router.get('/reset/:token', authController.getResetPassword);
router.post('/reset-password', authController.postResetPassword);

module.exports = router;
