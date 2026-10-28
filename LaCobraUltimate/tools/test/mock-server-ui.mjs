// Simulador de @minecraft/server-ui: los formularios responden con la selección
// que la prueba haya encolado en `formAnswers`.
export const formAnswers = [];
export const shownForms = [];

export class ActionFormData {
  constructor() {
    this.buttons = [];
  }
  title(t) {
    this.t = t;
    return this;
  }
  body(b) {
    this.b = b;
    return this;
  }
  button(text, icon) {
    this.buttons.push({ text, icon });
    return this;
  }
  async show() {
    shownForms.push(this);
    const sel = formAnswers.shift();
    return sel === undefined ? { canceled: true } : { canceled: false, selection: sel };
  }
}
