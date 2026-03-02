import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  create(createUserDto: CreateUserDto) {
    createUserDto.getEmail();
    return `Unimplemented method: This action adds a new user`;
  }

  findAll() {
    return `Unimplemented method: This action returns all users`;
  }

  findOne(id: number) {
    return `Unimplemented method: This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    updateUserDto.getUpdatedEmail();
    return `Unimplemented method: This action updates a #${id} user`;
  }

  remove(id: number) {
    return `Unimplemented method: This action removes a #${id} user`;
  }
}
