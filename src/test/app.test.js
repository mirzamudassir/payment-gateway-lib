const request = require("supertest");
const express = require("express");
const { app } = require("../app");

const { usePayPalPayment, useBraintreePayment } = require("../app");

describe("Payment Gateway Tests", () => {
  // Mock data for paypal testing
  const mockOrderDetailsPaypal = {
    currency_code: "USD",
    amount: 1,
    cardNumber: "4032030457877299",
    cardCvv: "882",
    cardExpiry: "07/2028",
    cardName: "Mudassir",
  };

  // Mock data for braintree testing
  const mockOrderDetailsBraintree = {
    currency_code: "THB",
    amount: 1,
    cardNumber: "4111111111111111",
    cardCvv: "882",
    cardExpiry: "07/2028",
    cardName: "Mudassir",
  };

  // Mock response for fetch
  const mockFetchResponse = {
    json: jest.fn().mockResolvedValue({ status: "COMPLETED" }),
    status: 200,
  };

  // Mock fetch function
  global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);

  // Clear mock data and reset mock functions before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test usePayPalPayment method
  describe("usePayPalPayment", () => {
    it("should process payment with PayPal successfully", async () => {
      const mockRequest = {
        body: mockOrderDetailsPaypal,
      };
      const mockResponse = {
        status: jest.fn(),
        send: jest.fn(),
      };

      await usePayPalPayment(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith("COMPLETED");
    });
  });

  // Test useBraintreePayment method
  describe("useBraintreePayment", () => {
    it("should process payment with Braintree successfully", async () => {
      const mockRequest = {
        body: mockOrderDetailsBraintree,
      };
      const mockResponse = {
        status: jest.fn(),
        send: jest.fn(),
      };

      await useBraintreePayment(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith(
        "submitted_for_settlement"
      );
    });
  });

  // hit endpoint with payload of PayPal Payment
  describe("POST /api/payment", () => {
    it("should process payment successfuly with PayPal", async () => {
      const response = await request(app)
        .post("/api/payment")
        .send(mockOrderDetailsPaypal);

      expect(response.status).toBe(200);
    });
  });

  // hit endpoint with payload of Braintree Payment
  describe("POST /api/payment", () => {
    it("should process payment successfuly with Braintree", async () => {
      const response = await request(app)
        .post("/api/payment")
        .send(mockOrderDetailsBraintree);

      expect(response.status).toBe(200);
    });
  });
});
