const {
  usePayPalPayment,
  useBraintreePayment
} = require("../app"); // Replace with the actual file name

describe("Payment Gateway Tests", () => {
  // Mock data for testing
  const mockOrderDetails = {
    currency_code: "USD",
    amount: 1,
    cardNumber: "4032030457877299",
    cardCvv: "882",
    cardExpiry: "07/2028",
    cardName: "Mudassir",
  };

  // Mock data for testing
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

  // Mock response for BraintreeGatewayInstance.transaction.sale
  const mockBraintreeResult = {
    // provide sample braintree result here
  };

  // // Mock BraintreeGatewayInstance
  // jest.mock('braintree', () => ({
  //   BraintreeGateway: jest.fn().mockImplementation(() => ({
  //     transaction: {
  //       sale: jest.fn().mockResolvedValue(mockBraintreeResult),
  //     },
  //   })),
  //   Environment: {
  //     Sandbox: 'sandbox',
  //   },
  // }));

  // Clear mock data and reset mock functions before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test usePayPalPayment method
  describe("usePayPalPayment", () => {
    it("should process payment with PayPal successfully", async () => {
      const mockRequest = {
        body: mockOrderDetails,
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
      expect(mockResponse.send).toHaveBeenCalledWith("submitted_for_settlement");
    });
  });

});

