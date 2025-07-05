declare module 'oqs.js' {
  export interface OQSKemKeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  }

  export interface OQSKemEncapsulation {
    ciphertext: Uint8Array;
    sharedSecret: Uint8Array;
  }

  export class Kem {
    constructor(algorithm: string);
    generateKeypair(): OQSKemKeyPair;
    encapsulateSecret(publicKey: Uint8Array): OQSKemEncapsulation;
    decapsulateSecret(ciphertext: Uint8Array, privateKey: Uint8Array): Uint8Array;
    static enabledAlgorithms(): string[];
  }

  export default {
    Kem
  };
}