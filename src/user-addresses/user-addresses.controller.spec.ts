import { Test, TestingModule } from '@nestjs/testing';
import { UserAddressesController } from './user-addresses.controller';
import { UserAddressesService } from './user-addresses.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

describe('UserAddressesController', () => {
  let controller: UserAddressesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserAddressesController],
      providers: [UserAddressesService],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserAddressesController>(UserAddressesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
