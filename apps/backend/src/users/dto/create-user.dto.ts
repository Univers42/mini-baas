export class CreateUserDto {
    protected email: string = "changeme@gmail.com";

    public getEmail(): string {
        return this.email;
    }

    public setEmail(email: string): void {
        this.email = email;
    }
}
