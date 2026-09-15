import { describe, expect, test } from 'bun:test';
import { decodeCeremonyOptions } from './decode-ceremony-options.ts';
import { decodeDevicePoll, decodeDeviceStart, decodeLoginRequestInfo } from './decode-device.ts';
import { decodeDevices } from './decode-devices.ts';
import { decodeEnrollment, decodeEnrollmentInfo } from './decode-enrollment.ts';
import { decodeIssuedLink } from './decode-issued-link.ts';
import { decodeKeys } from './decode-keys.ts';
import { decodeMe } from './decode-me.ts';
import { decodeSettings } from './decode-settings.ts';
import { decodeSignedIn } from './decode-signed-in.ts';

const token = { id: 'a', label: 'cli', createdAt: 1, current: false };
const passkey = { id: 'c', label: 'Laptop', createdAt: 1, backedUp: true };
const devices = { passkeys: [passkey], telegram: { linked: false }, tokens: [token] };

describe('decoders', () => {
  test('accept well-formed wire objects', () => {
    expect(decodeMe({ id: 1, name: 'A' })).toEqual({ id: 1, name: 'A' });
    expect(decodeSignedIn({ id: 1, name: 'A', recoveryCode: 'x' })).toEqual({ id: 1, name: 'A', recoveryCode: 'x' });
    expect(decodeSignedIn({ id: 1, name: 'A' })).toEqual({ id: 1, name: 'A' });
    expect(decodeCeremonyOptions({ options: { challenge: 'c' } })).toEqual({ options: { challenge: 'c' } });
    expect(decodeIssuedLink({ url: 'u', curl: 'c', ttlMinutes: 5 })).toEqual({ url: 'u', curl: 'c', ttlMinutes: 5 });
    expect(decodeKeys({ keys: ['a'] })).toEqual({ keys: ['a'] });
    expect(decodeSettings({ linkTtlMinutes: 5, presets: [1, 5] })).toEqual({ linkTtlMinutes: 5, presets: [1, 5] });
    expect(decodeDevices(devices)).toEqual(devices);
    expect(decodeEnrollment({ url: 'u', qr: 'q', expiresAt: 1 })).toEqual({ url: 'u', qr: 'q', expiresAt: 1 });
    expect(decodeEnrollmentInfo({ accountName: 'A' })).toEqual({ accountName: 'A' });
    expect(decodeDeviceStart({ url: 'u', pollToken: 'p', expiresAt: 1 })).toEqual({ url: 'u', pollToken: 'p', expiresAt: 1 });
    expect(decodeDevicePoll({ status: 'pending' })).toEqual({ status: 'pending' });
    expect(decodeDevicePoll({ status: 'approved', token: 't' })).toEqual({ status: 'approved', token: 't' });
    expect(decodeLoginRequestInfo({ kind: 'cli', label: 'l' })).toEqual({ kind: 'cli', label: 'l' });
  });

  test('reject wrong shapes', () => {
    expect(decodeMe({ id: '1', name: 'A' })).toBeUndefined();
    expect(decodeSignedIn({ id: 1, name: 'A', recoveryCode: 5 })).toBeUndefined();
    expect(decodeCeremonyOptions({ options: 'x' })).toBeUndefined();
    expect(decodeIssuedLink({ url: 'u' })).toBeUndefined();
    expect(decodeKeys({ keys: [1] })).toBeUndefined();
    expect(decodeSettings({ linkTtlMinutes: 5, presets: ['x'] })).toBeUndefined();
    expect(decodeDevices({ ...devices, telegram: {} })).toBeUndefined();
    expect(decodeEnrollment({ url: 'u' })).toBeUndefined();
    expect(decodeDeviceStart({ url: 'u' })).toBeUndefined();
    expect(decodeDevicePoll({ status: 'approved' })).toBeUndefined();
    expect(decodeLoginRequestInfo({ kind: 'other', label: 'l' })).toBeUndefined();
    expect(decodeMe([])).toBeUndefined();
    expect(decodeMe('x')).toBeUndefined();
  });
});
