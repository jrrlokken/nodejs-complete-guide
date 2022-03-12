const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const stripe = require('stripe')(process.env.STRIPE_SECRET);

const Product = require('../models/product');
const Order = require('../models/order');

const ITEMS_PER_PAGE = 4;

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((error) => {
      const newError = new Error(error);
      newError.httpStatusCode = 500;
      return next(newError);
    });
};

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'Products',
        path: '/products',
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((error) => {
      const newError = new Error(error);
      newError.httpStatusCode = 500;
      return next(newError);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products',
      });
    })
    .catch((error) => {
      const newError = new Error(error);
      newError.httpStatusCode = 500;
      return next(newError);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then((user) => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products,
      });
    })
    .catch((error) => {
      const newError = new Error(error);
      newError.httpStatusCode = 500;
      return next(newError);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;

  Product.findById(prodId)
    .then((product) => {
      return req.user.addToCart(product);
    })
    .then((result) => res.redirect('/'))
    .catch((error) => {
      const newError = new Error(error);
      newError.httpStatusCode = 500;
      return next(newError);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then((result) => {
      res.redirect('/cart');
    })
    .catch((error) => {
      const newError = new Error(error);
      newError.httpStatusCode = 500;
      return next(newError);
    });
};

/* Checkout */

exports.getCheckout = (req, res, next) => {
  let products;
  let total = 0;
  req.user
    .populate('cart.items.productId')
    .then((user) => {
      products = user.cart.items;
      total = 0;
      products.forEach((p) => {
        total += p.quantity * p.productId.price;
      });

      return stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: products.map((p) => {
          return {
            name: p.productId.title,
            description: p.productId.description,
            amount: p.productId.price * 100,
            currency: 'usd',
            quantity: p.quantity,
          };
        }),
        success_url:
          req.protocol + '://' + req.get('host') + '/checkout/success',
        cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel',
      });
    })
    .then((session) => {
      res.render('shop/checkout', {
        path: '/checkout',
        pageTitle: 'Checkout',
        products: products,
        totalCharge: total,
        sessionId: session.id,
      });
    })
    .catch((error) => {
      const newError = new Error(error);
      newError.httpStatusCode = 500;
      return next(newError);
    });
};

/* Orders */

exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user,
        },
        products: products,
      });
      return order.save();
    })
    .then((result) => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch((error) => {
      const newError = new Error(error);
      newError.httpStatusCode = 500;
      return next(newError);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then((orders) => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders,
      });
    })
    .catch((error) => {
      const newError = new Error(error);
      newError.httpStatusCode = 500;
      return next(newError);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        return next(new Error('No order found'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized'));
      }
      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', invoiceName);

      const pdfInvoice = new PDFDocument();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + invoiceName + '"'
      );

      pdfInvoice.pipe(fs.createWriteStream(invoicePath));
      pdfInvoice.pipe(res);

      pdfInvoice.fontSize(26).text('Invoice', {
        underline: true,
        lineGap: 10,
      });

      let totalPrice = 0;
      order.products.forEach((p) => {
        totalPrice += p.quantity * p.product.price;
        pdfInvoice
          .fontSize(16)
          .text(
            p.product.title + ' - ' + p.quantity + ' x ' + '$' + p.product.price
          );
      });
      pdfInvoice.text('-----------------------', {
        lineGap: 10,
      });
      pdfInvoice.fontSize(26).text('Total: $' + totalPrice.toFixed(2));

      pdfInvoice.end();

      // This works just fine for small files, such as our invoices,
      // but it may be a better practice to stream the data rather
      // than loading it all into memory.
      //
      // fs.readFile(invoicePath, (error, data) => {
      //   if (error) {
      //     return next(error);
      //   }
      // res.setHeader('Content-Type', 'application/pdf');
      // res.setHeader(
      //   'Content-Disposition',
      //   'inline; filename="' + invoiceName + '"'
      // );
      //   res.send(data);
      // });
    })
    .catch((error) => next(error));
};
