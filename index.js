#! /usr/bin/env node
const { Command, Option, InvalidArgumentError, Argument } = require("commander");
const Query = require("minecraft-query");
const util = require("util");
const dns = require("dns");
const lookup = util.promisify(dns.lookup);

const program = new Command();

const ipv4RegExp = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/i;
const ipv6RegExp = new RegExp("^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9"
                             + "a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F"
                             + "]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F"
                             + "]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9"
                             + "a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}"
                             + "[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|"
                             + "1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$", "gi");
const portRegExp = /^((6553[0-5])|(655[0-2][0-9])|(65[0-4][0-9]{2})|(6[0-4][0-9]{3})|([1-5][0-9]{4})|([0-5]{0,5})|([0-9]{1,4}))$/i;
const domainRegExp = /^([\w\d]+\.)?[\w\d]+\.[\w\d]{2,5}(?:\.[\w\d]{2,5})?$/i;

const _parseIPandPort = value => {
  let splitValue = value.split(":");
  const splitValueLength = splitValue.length;
  if (splitValue.length > 2) {
    const _splitValue = splitValue;
    const popped = _splitValue.pop();
    splitValue = [_splitValue.join(":"), popped];
  }

  if (value === undefined || value === null || value === "") {
    console.error(`The parameter <address:port> is undefined: ${value}.`);
    process.exit(1);
  } else if (splitValueLength === 2) {
    if (ipv4RegExp.test(splitValue[0])) {
      if (!portRegExp.test(splitValue[1])) {
        throw new InvalidArgumentError("Port is invalid.");
      }
    } else if (ipv6RegExp.test(splitValue[0])) {
      if (!portRegExp.test(splitValue[1])) {
        throw new InvalidArgumentError("Port is invalid.");
      }
    } else if (domainRegExp.test(splitValue[0])) {
      if (!portRegExp.test(splitValue[1])) {
        throw new InvalidArgumentError("Port is invalid.");
      }
    } else {
      throw new InvalidArgumentError("IP address is not an IPv4 or IPv6 or domain address.");
    }
  } else {
    console.error(`The parameter <address:port> is invalid: ${value} is ${splitValueLength} long when it should be 2.`);
    process.exit(1);
  }

  return [splitValue[0], splitValue[1]];
};

const dnsResolve = async domain => {
  const domainTest = domainRegExp.test(domain);
  if (domainTest) {
    let addressLookedUp;
    try {
      addressLookedUp = await lookup(domain);
    } catch (error) {
      console.error(`Could not resolve domain ${domain} on the dns server.\n${error}`);
      process.exit(1);
    } finally {
      domain = addressLookedUp.address;
    }
  }

  return domain;
};

const queryServer = async (address, options) => {
  let timeout = 7500;
  try {
    if (options.timeout === undefined) {
      throw new InvalidArgumentError("The option Timeout is undefined.");
    } else if (typeof options.timeout === "string") {
      timeout = parseInt(options.timeout, 10);
    } else if (typeof options.timeout === "number") {
      timeout = options.timeout;
    } else {
      throw new InvalidArgumentError(`The option Timeout is invalid.\ntypeof: ${typeof options.timeout}`);
    }
  } catch (error) {
    console.error(`Failed to parse ${options.timeout} as a decimal.\n${error}`);
  }

  const dnsResolved = await dnsResolve(address[0]);
  const newAddress = [dnsResolved, address[1]];

  const q = new Query({ host: newAddress[0], port: newAddress[1], timeout });
  try {
    const fullStated = await q.fullStat();
    console.log(fullStated);
    const basicStated = await q.basicStat();
    console.log(basicStated);
  } catch (error) {
    console.error(`Could not get query of minecraft at ${newAddress[0]}:${newAddress[1]}.\n${error}`);
  } finally {
    q.close();
    process.exit(1);
  }
};

program
  .name("minecraft-query-exec")
  .version("1.0.5", "Query's a minecraft server p;ort")
  .addArgument(
    new Argument("<address:port>", "The address and port of the server.")
      .default("localhost:25565", "Local minecraft server on the default port")
      .argParser(_parseIPandPort)
      .argRequired())
  .addOption(
    new Option("-t, --timeout [int]", "The length in ms for timeout")
      .default("7500", "The default timeout")
  )
  .action(queryServer)
  .parse(process.argsv);
