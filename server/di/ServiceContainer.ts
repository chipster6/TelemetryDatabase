export interface ServiceToken<T> {
  name: string;
}

export interface IServiceContainer {
  register<T>(token: ServiceToken<T>, factory: () => T): void;
  registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void;
  resolve<T>(token: ServiceToken<T>): T;
}

export class ServiceContainer implements IServiceContainer {
  private services = new Map<string, any>();
  private singletons = new Map<string, any>();
  private factories = new Map<string, () => any>();

  register<T>(token: ServiceToken<T>, factory: () => T): void {
    this.factories.set(token.name, factory);
  }

  registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void {
    this.factories.set(token.name, factory);
    this.singletons.set(token.name, null);
  }

  resolve<T>(token: ServiceToken<T>): T {
    if (this.singletons.has(token.name)) {
      let instance = this.singletons.get(token.name);
      if (!instance) {
        const factory = this.factories.get(token.name);
        if (!factory) {
          throw new Error(`Service not registered: ${token.name}`);
        }
        instance = factory();
        this.singletons.set(token.name, instance);
      }
      return instance;
    }
    
    const factory = this.factories.get(token.name);
    if (!factory) {
      throw new Error(`Service not registered: ${token.name}`);
    }
    return factory();
  }

  has(token: ServiceToken<any>): boolean {
    return this.factories.has(token.name);
  }

  reset(): void {
    this.services.clear();
    this.singletons.clear();
    this.factories.clear();
  }
}