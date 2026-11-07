export class ActionFormData { title() { return this; } body() { return this; } button() { return this; } show() { return Promise.resolve({ canceled: true }); } }
export class ModalFormData extends ActionFormData {}
export class MessageFormData extends ActionFormData {}
