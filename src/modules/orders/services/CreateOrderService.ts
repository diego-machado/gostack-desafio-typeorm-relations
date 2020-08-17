import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';

import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);

    if (!findCustomer) {
      throw new AppError('This customer does not exists');
    }

    const productsId = products.map(product => ({ id: product.id }));

    const findProducts = await this.productsRepository.findAllById(productsId);

    if (findProducts.length !== products.length) {
      throw new AppError('One or more products was not found');
    }

    const productsToUpdate: IUpdateProductsQuantityDTO[] = [];

    const updatedProducts = findProducts.map(findProduct => {
      const productsOrder = products.find(
        product => product.id === findProduct.id,
      );

      if (!productsOrder) {
        return findProduct;
      }
      if (findProduct.quantity < productsOrder.quantity) {
        throw new AppError('Quantity not available!');
      }

      productsToUpdate.push({
        id: productsOrder.id,
        quantity: findProduct.quantity - productsOrder.quantity,
      });

      return {
        ...findProduct,
        quantity: productsOrder.quantity,
      };
    });

    await this.productsRepository.updateQuantity(productsToUpdate);

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: updatedProducts.map(product => ({
        product_id: product.id,
        price: product.price,
        quantity: product.quantity,
      })),
    });

    return order;
  }
}

export default CreateOrderService;
