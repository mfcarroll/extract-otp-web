import protobuf from 'protobufjs';
import schema from './otp_migration.proto?raw';

// The schema is bundled rather than fetched at runtime, so decoding works from
// any page path (including the translated sub-pages) without a network request.
export const migrationRoot = protobuf.parse(schema).root;
