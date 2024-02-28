const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const braintree = require("braintree");

require("dotenv").config();

////////////////////////////////////////////////////////////////////////
/////////////////////////// Init ///////////////////////////////////////
////////////////////////////////////////////////////////////////////////


// const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
// const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_CLIENT_ID =
  "AaUNAIE0Etx6fGKLNFqjegei4k-OxzrnF1ZSPmQGC7DqJhj0lWiN-oTvqzmqlPoJAp2_xKIP3o9gPHju";
const PAYPAL_CLIENT_SECRET =
  "EK-WFIzd_8tIcT3NNUFS11QViLyt4NCj6hR5Z7JFWuwpCchH2-L66X8Dl7l-bYKGcp5k3-JAkc6HnWqU";

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
  merchantId: "589rst5qbwq8chkx",
  publicKey: "xs9jthv6zqpnbhzt",
  privateKey: "38e33f5ff896c7e91dc7c01cf6814c75",
});


////////////////////////////////////////////////////////////////////////
/////////////////////// Payment Gateways ///////////////////////////////
////////////////////////////////////////////////////////////////////////


/**
   Braintree payment method
*/
async function brainTreePayment(orderDetails) {
  const braintreeResult = await braintreeGatewayInstance.transaction.sale({
    amount: orderDetails.amount,
    creditCard: {
      number: orderDetails.cardNumber,
      expirationDate: orderDetails.cardExpiry,
      cvv: orderDetails.cardCvv,
      cardholderName: orderDetails.cardName,
    },
    options: { submitForSettlement: true },
  });

  return handleResponse(braintreeResult);
}


/**
 * Generate access token for accessing the paypal api
 */
async function generateAccessToken() {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
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
    console.error("Failed to generate Access Token:", error);
  }
}


/**
 * PayPal Payment method
 * Step 1. Create order and return order id
 */
async function createOrder(orderDetails) {
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
    const accessToken = await generateAccessToken();
  
    const url = `${paypalApiBaseUrl}/v2/checkout/orders/${orderId}/confirm-payment-source`;
    const payload = {
      payment_source: {
        card: {
          number: orderDetails.cardNumber, //4032031521905041
          security_code: orderDetails.cardCvv, //575
          expiry: orderDetails.cardExpiry, //2027-04
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
 * It will satisfy the paypal payment
 */
async function captureOrder(orderID) {
  const accessToken = await generateAccessToken();
  const url = `${paypalApiBaseUrl}/v2/checkout/orders/${orderID}/capture`;

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
  } catch (err) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}


/**
 * Route for payment processing
 */
app.post("/api/payment", async (req, res) => {
  try {
    const orderDetails = req.body;
    console.log(">>>>>>>>>>>>>>>>", req.body);

    // Check if cardNumber starts with '3' (indicating AMEX)
    const isAmex = orderDetails.cardNumber.startsWith("3");

    // Check if currency is USD, EUR, or AUD
    const isSupportedCurrency = ["USD", "EUR", "AUD"].includes(
      orderDetails.currency_code
    );

    try {
      if (isAmex && orderDetails.currency_code !== "USD") {
        // If AMEX card and not in USD, return an error
        res
          .status(400)
          .json({
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
      res.status(500).json({ error: "Failed to process payment." });
    }
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});



////////////////////////////////////////////////////////////////////////
/////////////////////// Helper Methods /////////////////////////////////
////////////////////////////////////////////////////////////////////////



/**
* Helper method: Paypal payment
*/
async function usePayPalPayment(req, pgRes) {
  try {
    const orderDetails = req.body;
    console.log(">>>>>>>>>>>>>>>>", req.body);

    // Step 1: Create order
    const { jsonResponse: createOrderResponse } = await createOrder(
      orderDetails
    );

    // Step 2: Approve payment source
    const { jsonResponse: approveResponse } = await approvePaymentSource(
      createOrderResponse.id,
      orderDetails
    );

    // Step 3: Capture payment
    const { jsonResponse, httpStatusCode } = await captureOrder(
      createOrderResponse.id
    );

    // Respond with the capture response
    pgRes.status(httpStatusCode).send(jsonResponse.status);
    console.log(jsonResponse.status);
  } catch (error) {
    console.error("Failed to process payment with PayPal:", error);
    pgRes.status(500).json({ error: "Failed to process payment with PayPal." });
  }
}


/**
* Helper method: Braintree payment
*/
async function useBraintreePayment(brreq, pgRess) {
  try {
    const orderDetails = brreq.body;
    const { jsonResponse, httpStatusCode } = await brainTreePayment(
      orderDetails
    );
    pgRess.status(httpStatusCode).send(jsonResponse.status);
  } catch (error) {
    console.error("Failed to process payment with Braintree:", error);
    pgRess.status(500).json({ error: "Failed to process payment with Braintree." });
  }
}


/**
 * server
 */
app.listen(port, () => {
  console.log(`server listening at http://localhost:${port}/`);
});