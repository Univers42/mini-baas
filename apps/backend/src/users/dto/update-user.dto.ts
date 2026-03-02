import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    private updatedEmail: string = "changeme@gmail.com";

    public getUpdatedEmail(): string {
        return this.updatedEmail;
    }

    public setUpdatedEmail(email: string): void {
        this.updatedEmail = email;
    }
}
