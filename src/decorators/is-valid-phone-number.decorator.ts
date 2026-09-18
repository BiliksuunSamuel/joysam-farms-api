import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidPhoneNumber } from 'src/utils';

@ValidatorConstraint({ name: 'isValidPhoneNumber', async: false })
class IsValidPhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidPhoneNumber(value);
  }

  defaultMessage(): string {
    return '$property must be a valid phone number';
  }
}

// Accepts either a local number (assumed Ghana) or one already in
// international format - see isValidPhoneNumber in src/utils.
export function IsValidPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPhoneNumberConstraint,
    });
  };
}
