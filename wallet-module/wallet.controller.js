const walletService = require("./wallet.service");

module.exports.createPayment = async (ctx) => {
  const { amount } = ctx.request.body;
  const user = ctx.state.user;

  const paymentCode = await walletService.createPayment(amount, user);
  ctx.status = 200;
  ctx.body = { paymentCode };
};

module.exports.verifyPayment = async (ctx) => {
  const res = await walletService.verifyPayment(ctx.request.body);
  // we put the verify service response in this html and return it
  ctx.body = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirect Page</title>

    <style>
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #333; /* Dark background color */
            color: #fff; /* Text color */
            font-family: 'Courier New', monospace;
        }

        h1, button {
            margin-bottom: 20px;
        }

        button {
            padding: 10px 20px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            background-color: #ccc; /* Neutral gray */
            color: #333; /* Text color */
            border: none;
            border-radius: 5px;
            transition: background-color 0.3s;
        }

        button:hover {
            background-color: #bbb; /* Slightly darker gray on hover */
        }
    </style>
</head>
<body>

    <h2>${res}</h2>

    <button onclick="redirectToURL()">برای بازگشت به صفحه‌ی نخست اینجا کلیک کنید</button>

    <script>
        function redirectToURL() {
            window.location.href = "https://your.domain/home";
        }
    </script>

</body>
</html>
`;
};
