const Router = require("@koa/router");

const walletController = require("./wallet.controller");
const { checkUserScope, scope } = require("path/to/rbacMiddleware");
const validate = require("path/to/validateMiddlewares");
const { createPayment } = require("./wallet.validation");

const router = new Router({ prefix: "/wallet" });

router.post(
  "/create-payment",
  checkUserScope(scope.CREATE_PAYMENT), // check user access level
  validate(createPayment), // check incoming data
  walletController.createPayment
);

router.post("/verify-payment", walletController.verifyPayment); // this route is called by the payment gateway

module.exports = router.routes();
