import { faker } from '@faker-js/faker';

export class TestDataFactory {
  static createUser(overrides = {}) {
    return {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      password: faker.internet.password({ length: 12 }),
      ...overrides,
    };
  }

  static createAddress(overrides = {}) {
    return {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      state: faker.location.state(),
      zip: faker.location.zipCode(),
      country: faker.location.country(),
      ...overrides,
    };
  }

  static createProduct(overrides = {}) {
    return {
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price: parseFloat(faker.commerce.price()),
      category: faker.commerce.department(),
      sku: faker.string.alphanumeric(8).toUpperCase(),
      ...overrides,
    };
  }

  static createOrder(overrides = {}) {
    return {
      orderId: faker.string.uuid(),
      product: this.createProduct(),
      quantity: faker.number.int({ min: 1, max: 10 }),
      shippingAddress: this.createAddress(),
      ...overrides,
    };
  }
}
