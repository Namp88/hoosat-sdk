import { describe, expect, it } from 'vitest';
import { HoosatWallet } from '@wallet/wallet';
import { HoosatUtils } from '@utils/utils';

describe('HoosatWallet - address management', () => {
  it('creates an HD wallet with one deposit address by default', () => {
    const wallet = new HoosatWallet({
      network: 'testnet',
      hd: {
        seed: '000102030405060708090a0b0c0d0e0f',
        coinType: 0,
        account: 0,
      },
    });

    expect(wallet.addresses.length).toBe(1);
    expect(HoosatUtils.isValidAddress(wallet.address)).toBe(true);
    expect(HoosatUtils.getAddressNetwork(wallet.address)).toBe('testnet');
    expect(HoosatUtils.getAddressType(wallet.address)).toBe('ecdsa');

    const infos = wallet.getAddressInfo();
    expect(infos[0]!.role).toBe('deposit');
    expect(infos[0]!.index).toBe(0);
  });

  it('createNewAddress() creates the next deposit address (HD) and sets it active by default', () => {
    const wallet = new HoosatWallet({
      network: 'testnet',
      hd: { seed: '000102030405060708090a0b0c0d0e0f' },
    });

    const before = wallet.address;
    const created = wallet.createNewAddress();

    expect(wallet.addresses.length).toBe(2);
    expect(wallet.address).toBe(created.address);
    expect(wallet.address).not.toBe(before);
    expect(HoosatUtils.getAddressNetwork(created.address)).toBe('testnet');
  });

  it('createChangeAddress() creates a change address (HD) without switching active address by default', () => {
    const wallet = new HoosatWallet({
      network: 'mainnet',
      hd: { seed: '000102030405060708090a0b0c0d0e0f' },
    });

    const activeBefore = wallet.address;
    const change = wallet.createChangeAddress();

    expect(wallet.address).toBe(activeBefore);
    expect(wallet.addresses).toContain(change.address);
    expect(HoosatUtils.getAddressNetwork(change.address)).toBe('mainnet');

    const changeInfo = wallet.getAddressInfo().find((i: { address: string; role: string; index?: number }) => i.address === change.address);
    expect(changeInfo?.role).toBe('change');
    expect(changeInfo?.index).toBe(0);
  });

  it("mode: 'htnwallet' defaults to Schnorr + deposit index starts at 1", () => {
    const wallet = new HoosatWallet({
      network: 'testnet',
      hd: {
        mode: 'htnwallet',
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      },
    });

    expect(wallet.addresses.length).toBe(1);
    expect(HoosatUtils.getAddressNetwork(wallet.address)).toBe('testnet');
    expect(HoosatUtils.getAddressType(wallet.address)).toBe('schnorr');

    const info = wallet.getAddressInfo()[0]!;
    expect(info.role).toBe('deposit');
    expect(info.index).toBe(1);

    const next = wallet.createNewAddress();
    const nextInfo = wallet.getAddressInfo().find((i: { address: string; index?: number }) => i.address === next.address)!;
    expect(nextInfo.index).toBe(2);
    expect(HoosatUtils.getAddressType(next.address)).toBe('schnorr');
  });
});
