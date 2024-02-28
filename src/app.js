const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const braintree = require("braintree");

require("dotenv").config();

////////////////////////////////////////////////////////////////////////
/////////////////////////// Init ///////////////////////////////////////
////////////////////////////////////////////////////////////////////////

const paypalClientId = process.env.PAYPAL_CLIENT_ID;
const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;

// define the paypal api base url
const paypalApiBaseUrl = "https://api-m.sandbox.paypal.com";

//fire up the app with necessary params
const app = express();
const port = process.env.PORT || 8000;
app.use(express.json());
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: false }));

// Configure Braintree Payment Gateway Instance
const braintreeGatewayInstance = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});

////////////////////////////////////////////////////////////////////////
/////////////////////// Payment Gateways ///////////////////////////////
////////////////////////////////////////////////////////////////////////

/**
   Braintree payment method
*/
async function brainTreePayment(orderDetails) {
  try {
    //format the expiration month and year MM/YYYY
    const [cardExpirationMonth, cardExpirationYear] =
      orderDetails.cardExpiry.split("/");

    const braintreeResult = await braintreeGatewayInstance.transaction.sale({
      amount: orderDetails.amount,
      creditCard: {
        number: orderDetails.cardNumber,
        expirationMonth: cardExpirationMonth,
        expirationYear: cardExpirationYear,
        cvv: orderDetails.cardCvv,
        cardholderName: orderDetails.cardName,
      },
      options: { submitForSettlement: true },
    });

    //format the response
    const jsonResponse = {
      status:
        braintreeResult.transaction && braintreeResult.transaction.status
          ? braintreeResult.transaction.status
          : braintreeResult.message,
    };

    return {
      jsonResponse,
      httpStatusCode: 200,
    };
  } catch (error) {
    const jsonResponse = { status: error.message };

    return {
      jsonResponse,
      httpStatusCode: 500,
    };
  }
}

/**
 * Generate access token for accessing the paypal api
 */
async function generateAccessToken() {
  try {
    if (!paypalClientId || !paypalClientSecret) {
      throw new Error("MISSING_API_CREDENTIALS");
    }
    const auth = Buffer.from(
      paypalClientId + ":" + paypalClientSecret
    ).toString("base64");
    const response = await fetch(`${paypalApiBaseUrl}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    res.status(500).json({ error: "Failed to generate Access Token." });
    console.error("Failed to generate Access Token:", error);
  }
}

/**
 * PayPal Payment method
 * Step 1. Create order and return order id
 */
async function createOrder(orderDetails) {
  //get the access token
  const accessToken = await generateAccessToken();

  const url = `${paypalApiBaseUrl}/v2/checkout/orders`;
  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: orderDetails.currency_code,
          value: orderDetails.amount,
        },
      },
    ],
  };

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

/**
 * PayPal Payment method
 * Step 2. Approve the payment source e.g credit card
 */
async function approvePaymentSource(orderId, orderDetails) {
  //format expiration date from MM/YYYY to YYYY-MM
  const [month, year] = orderDetails.cardExpiry.split("/");
  const cardExpiration = `${year}-${month}`;

  //get the access token
  const accessToken = await generateAccessToken();

  const url = `${paypalApiBaseUrl}/v2/checkout/orders/${orderId}/confirm-payment-source`;
  const payload = {
    payment_source: {
      card: {
        number: orderDetails.cardNumber, //4032031521905041
        security_code: orderDetails.cardCvv, //575
        expiry: cardExpiration, //2027-04
        name: orderDetails.cardName, //mudassir
      },
    },
  };

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

/**
 * PayPal Payment method
 * Step 3. Capture the order agains the order id
 * This step will satisfy the paypal payment
 */
async function captureOrder(orderId) {
  const accessToken = await generateAccessToken();
  const url = `${paypalApiBaseUrl}/v2/checkout/orders/${orderId}/capture`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleResponse(response);
}

async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();

    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (error) {
    const errorMessage = error ? await error : "Unknown error";
    throw new Error(errorMessage);
  }
}

////////////////////////////////////////////////////////////////////////
/////////////////////////// Routes /////////////////////////////////////
////////////////////////////////////////////////////////////////////////

/**
 * Route for payment processing
 * To use another payment gateway, use the defined helper method here
 */
app.post("/api/payment", async (req, res) => {
  try {
    const orderDetails = req.body;

    // Check if cardNumber starts with '3' (indicating AMEX) in order to use paypal
    const isAmex = orderDetails.cardNumber.startsWith("3");
    // define currencies to be use with amex
    const isAmexCurrency = ["USD", "EUR", "AUD"];

    // Check if currency is USD, EUR, or AUD in order to use paypal
    const isSupportedCurrency = isAmexCurrency.includes(
      orderDetails.currency_code
    );

    try {
      if (isAmex && orderDetails.currency_code !== "USD") {
        // If AMEX card and not in USD, return an error
        res.status(400).json({
          error: "AMEX is only possible to use for USD transactions.",
        });
      } else if (isAmex || isSupportedCurrency) {
        const paypalResponse = await usePayPalPayment(req, res);
        res.send(paypalResponse);
      } else {
        const braintreeResponse = await useBraintreePayment(req, res);
        res.send(braintreeResponse);
      }
    } catch (error) {
      console.error("Failed to process payment:", error);
      res.status(500);
      res.send(`Failed to process payment: ${error}`);
    }
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500);
    res.send(`Failed to create order: ${error}`);
  }
});

/**
 * frontend route
 */
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

////////////////////////////////////////////////////////////////////////
/////////////////////// Helper Methods /////////////////////////////////
//
// To add more payment gateways, include/write the implementation and 
// define the helpder method here.                                     
//
////////////////////////////////////////////////////////////////////////

/**
 * Helper method: Paypal payment
 */
async function usePayPalPayment(req, pgRes) {
  try {
    console.log(">>>>>>>>>>>>>>>>>>> using paypal payment");
    const orderDetails = req.body;

    // Step 1: Create order
    const { jsonResponse: createOrderResponse } = await createOrder(
      orderDetails
    );

    // Step 2: Approve payment source
    const { jsonResponse: approvePaymentResponse } = await approvePaymentSource(
      createOrderResponse.id,
      orderDetails
    );

    // Step 3: Capture payment
    const { jsonResponse: captureOrderResponse } = await captureOrder(
      createOrderResponse.id
    );

    // Respond with the capture response
    pgRes.status(200);
    pgRes.send(
      `PayPal Payment: ${
        captureOrderResponse && captureOrderResponse.status
          ? captureOrderResponse.status
          : captureOrderResponse.message
      }`
    );
  } catch (error) {
    console.error("Failed to process payment with PayPal:", error);
    pgRes.status(500);
    pgRes.send(`Failed to process payment with PayPal: ${error}`);
  }
}

/**
 * Helper method: Braintree payment
 */
async function useBraintreePayment(brreq, pgRess) {
  try {
    console.log(">>>>>>>>>>>>>>>>>>> using braintree payment");
    const orderDetails = brreq.body;
    const { jsonResponse: braintreePaymentResponse } = await brainTreePayment(
      orderDetails
    );

    // Respond with the capture response
    pgRess.status(200);
    pgRess.send(`Braintree Payment: ${braintreePaymentResponse.status}`);
  } catch (error) {
    console.error("Failed to process payment with Braintree:", error);
    pgRess.status(500);
    pgRess.send(`Failed to process payment with Braintree: ${error}`);
  }
}

/**
 * server
 */
const server = app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

// export modules for test cases
module.exports = {
  app,
  server,
  usePayPalPayment,
  useBraintreePayment,
};
