const express = require('express');
const braintree = require('braintree');
const paypal = require('paypal-rest-sdk');
const bodyParser = require('body-parser');


require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;


app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// Configure Braintree
const braintreeGateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});


// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});


app.post('/process-payment', async (req, res) => {
  const { price, currency, fullName, cardHolderName, cardNumber, cardExpiration, cardCvv } = req.body;

  // Braintree
  const braintreeResult = await braintreeGateway.transaction.sale({
    amount: price,
    creditCard: {
      number: cardNumber,
      expirationDate: cardExpiration,
      cvv: cardCvv,
      cardholderName: cardHolderName,
    },
    options: { submitForSettlement: true },
  });


  //response
  if (braintreeResult.success) {
    res.send('Payment successful!');
  } else {
    console.log(braintreeResult.message);
    res.status(500).send('Payment failed. Please try again.');
  }
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`)
});