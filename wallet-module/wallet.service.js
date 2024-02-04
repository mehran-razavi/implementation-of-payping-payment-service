const { PrismaClient } = require("@prisma/client");
const httpStatus = require("http-status");
const catchify = require("catchify");
const axios = require("axios");

const { ApiError } = require("path/to/ApiError");
const cacheService = require("path/to/cacheService");

class WalletService {
  #paypingBearerToken = process.env.PAYPING_BEARER_TOKEN;
  constructor() {
    this.prisma = new PrismaClient();
  }

  async createPayment(amount, { id, role }) {
    /*
    First, we need to check the user who requested payment.
    We know that all our users are not always stored in the same table. That's why we added the 'role' here.
    */
    const user = await this.prisma[role].findUnique({
      where: { id },
      select: {
        firstname: true,
        lastname: true,
        phone: true,
        email: true,
      },
    });
    if (!user)
      throw new ApiError({
        statusCode: httpStatus.BAD_REQUEST,
        code: httpStatus[400],
        message: "user not exist",
      });
    /*
    Now we put the parameters we need to make the payment in an object.
    */
    const referralCode = this.getUniqueString();
    const postData = {
      amount,
      payerIdentity: user.phone || user.email,
      payerName: `${user.firstname} ${user.lastname}`,
      description: "wallet charging",
      returnUrl: "https://your.domain/wallet/verify-payment",
      clientRefId: referralCode,
    };
    const axiosConfig = {
      method: "post",
      url: "https://api.payping.ir/v2/pay",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.#paypingBearerToken}`,
      },
      data: postData,
    };

    const [error, response] = await catchify(axios(axiosConfig));
    if (error) {
      throw new ApiError({
        statusCode: httpStatus.BAD_REQUEST,
        code: httpStatus[400],
        message: "payment gateway error",
      });
    }
    // create transaction
    const transaction = await this.prisma.transaction.create({
      data: {
        amount,
        payedFor: "WALLET_CHARGING",
        status: "ON_HOLD",
        source: "PAYPING",
        currency: "TOMAN",
        [role]: { connect: { id } },
      },
    });
    // caching required info
    await cacheService.cacheWithExpire(
      response.data.code, // key for restore cached data
      { amount, transactionId: transaction.id, user: { id, role } }, // payload
      60 * 15 // expire time (15 min)
    );
    // return payment code
    return response.data.code;
  }

  async verifyPayment(paymentDetails) {
    // restore cached data
    const cachedData = await cacheService.getCache(paymentDetails.code);
    // create request requirements
    const postData = {
      refId: paymentDetails.refid,
      amount: cachedData.amount,
    };
    const axiosConfig = {
      method: "post",
      url: "https://api.payping.ir/v2/pay/verify",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.#paypingBearerToken}`,
      },
      data: postData,
    };

    const [error, response] = await catchify(axios(axiosConfig));
    if (error) {
      await this.failTransaction(
        cachedData.transactionId,
        JSON.stringify(error.response.data)
      );
      return `تراکنش ناموفق ${error.response.status}: ${JSON.stringify(error.response.data)}`;
    }
    // get user wallet
    const wallet = await this.getWallet(cachedData.user);
    // update transaction and increase wallet balance.
    await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: cachedData.transactionId },
        data: {
          status: "SUCCESS",
          refID: Number(paymentDetails.refid),
          card: {
            cardNumber: response.data.cardNumber,
            cardHashPan: response.data.cardHashPan,
          },
        },
      }),
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: response.data.amount,
          },
        },
      }),
    ]);
    // last but not least;
    return "تراکنش موفق";
  }

  // internal use
  getUniqueString() {
    return `${Date.now()}${Math.floor(Math.random() * 90000 + 10000)}`;
  }

  async getWallet({ id, role }) {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        [role]: {
          id,
        },
      },
    });
    return wallet;
  }

  async failTransaction(transactionId, failureReason = undefined) {
    const transaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "FAILED",
        failureReason,
      },
    });
    return transaction;
  }
}

module.exports = new WalletService();
