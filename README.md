# payment-gateway-lib

Payment gateway library with express.js

>  How would you handle security for saving credit cards? <br>
   We can use Tokenization provided by paypal with additional encryption to save the credit cards information. Moreover, it also depends on the application infrastructure.

## Prerequisite

1. Node

## Usage

1. `npm/yarn install`

2. `create .env file and put required credentials there`

3. `npm run dev`

4. Run test cases `npm run test`

5. Access the app `http://localhost:8000`

## Guide

1. To add more payment gateways, include/write the implementation, and define the helpder method in `/src/app.js`   

## References

1. Follow this document for Cards testing against PayPal
   `https://developer.paypal.com/tools/sandbox/card-testing/`

2. Follow this document for Cards testing against Braintree
   `https://developer.paypal.com/braintree/docs/reference/general/testing/node` 
