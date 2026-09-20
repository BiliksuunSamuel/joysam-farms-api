import configuration from 'src/configuration';

export default () => ({
  secret: configuration().jwtSecret,
  sessionTimeoutMinutes: configuration().sessionTimeoutMinutes,
});
