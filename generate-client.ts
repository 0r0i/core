/* tslint:disable:no-console */
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import { compile } from 'json-schema-to-typescript';
import * as yargs from 'yargs';
import { ISchema } from './swagger';
import * as Swagger from './swagger';

interface IEvent {
  path: string;
  description: string;
  operation: string;
  params: string;
  returns: string;
}

export interface IEventsSchema {
  events: IEvent[];
  schema: {
    title: string;
  }[];
}

interface ITemplateView {
  events: IEvent[];
  services: ITemplateService[];
  models: ITemplateModel[];
  baseUrl: string;
  apiPath: string;
}

interface ITemplateService {
  name: string;
  operations: ITemplateOperation[];
}

interface ITemplateModel {
  name: string;
  description?: string;
  properties: Array<{
    propertyName: string;
    propertyType: string;
    description?: string;
  }>;
}

interface ITemplateOperation {
  id: string;
  method: string;
  signature: string;
  urlTemplate: string;
  returnType: string;
  paramsInterfaceName?: string;
  parameters?: ITemplateOperationParameters[];
  queryParameters?: string[];
  bodyParameter?: string;
  hasParameters: boolean;
  hasBodyParameter: boolean;
  description?: string;
}

interface ITemplateOperationParameters {
  parameterName: string;
  parameterType: string;
  description?: string;
}

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0 as any;
const baseApiUrl = yargs.argv.baseApiUrl;
if (!baseApiUrl) {
  throw new Error('No baseApiUrl provided.');
}

const template = (eventModelContent: string) => handlebars.compile(`/* tslint:disable */
import { ApiService, IAdditionalHeaders, IRequestParams } from '../api-service';
import ReconnectingWebsocket from 'reconnecting-websocket';

export namespace ErcDex {
  export let socket: ReconnectingWebsocket;
  let baseApiUrl: string;
  let apiKeyId: string | undefined;
  let hasWebSocket: boolean;
  let socketOpen = false;

  let subscriptions: {
    [channel: string]: {
      callbacks: Array<(data: any) => void>,
      resub: () => void,
      subActive: boolean
    } | undefined
  } = {};

  const send = (message: string, tries = 0) => {
    if (socketOpen) {
      socket.send(message);
      return;
    }

    // retry for 20 seconds
    if (tries < 20) {
      setTimeout(() => {
        send(message, tries + 1);
      }, 250);
    } else {
      console.log('failed to send');
    }
  };

  export const getApiKeyId = () => apiKeyId;

  /**
   * Initialize the Aqueduct client. Required to use the client.
   */
  export const Initialize = (params?: { host?: string; apiKeyId?: string; clientId?: string; }) => {
    const hasProcess = typeof process !== 'undefined' && process.env;
    const host = (params && params.host) || (hasProcess && process.env.AQUEDUCT_HOST) || 'app.ercdex.com';
    baseApiUrl = \`https://\${host}\`;

    if (params) {
      apiKeyId = params.apiKeyId;
    }

    if (hasProcess && baseApiUrl.indexOf('localhost') !== -1) {
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0 as any;
    }

    hasWebSocket = typeof WebSocket !== 'undefined';
    if (!hasWebSocket) {
      return;
    }

    let wsEndpoint = \`wss:\${host}\` + '/ws';
    if (params && params.clientId) {
      wsEndpoint += '?client_id=' + params.clientId;
    }
    socket = new ReconnectingWebsocket(wsEndpoint, undefined);

    socket.onopen = () => {
      Object.keys(subscriptions).map(k => subscriptions[k]).forEach(s => {
        if (s && !s.subActive) {
          s.resub();
          s.subActive = true;
        }
      });
      socketOpen = true;
    };

    socket.onclose = () => {
      Object.keys(subscriptions).map(k => subscriptions[k]).forEach(s => {
        if (s) {
          s.subActive = false;
        }
      });
      socketOpen = false;
    };

    socket.onmessage = event => {
      try {
        const data = JSON.parse(event.data) as { channel?: string; data: any };
        if (data.channel) {
          const sub = subscriptions[data.channel];
          if (sub) {
            sub.callbacks.forEach(cb => cb(data.data));
          }
        }
      } catch(err) {
        return;
      }
    };
  };

  /**
   * Namespace representing REST API for ERC dEX
   */
  export namespace Api {
    {{#models}}

    {{#if description}}
    /**
     * {{description}}
     */
    {{/if}}
    export interface {{name}} {
      {{#properties}}
      {{#if description}}
      /**
       * {{description}}
       */
      {{/if}}
      {{propertyName}}: {{propertyType}};
      {{/properties}}
    }
    {{/models}}

    {{#services}}
    {{#operations}}
    {{#if hasParameters}}

    export interface {{paramsInterfaceName}} {
      {{#parameters}}
      {{#if description}}
      /**
       * {{description}}
       */
      {{/if}}
      {{parameterName}}: {{parameterType}};
      {{/parameters}}
    }
    {{/if}}
    {{/operations}}
    {{/services}}
    {{#services}}
    export interface I{{name}} {
      {{#operations}}

      {{#if description}}
      /**
       * {{description}}
       */
      {{/if}}
      {{id}}({{signature}}): Promise<{{returnType}}>;
      {{/operations}}
    }

    export class {{name}} extends ApiService implements I{{name}} {
      {{#operations}}

      {{#if description}}
      /**
       * {{description}}
       */
      {{/if}}
      public async {{id}}({{signature}}) {
        const requestParams: IRequestParams = {
          method: '{{method}}',
          url: \`\${baseApiUrl}{{../../apiPath}}{{urlTemplate}}\`
        };
        {{#if queryParameters}}

        requestParams.queryParameters = {
        {{#queryParameters}}
          {{this}}: params.{{this}},
        {{/queryParameters}}
        };
        {{/if}}
        {{#if hasBodyParameter}}

        requestParams.body = params.{{bodyParameter}};
        {{/if}}
        requestParams.apiKeyId = apiKeyId;
        return this.executeRequest<{{returnType}}>(requestParams, headers);
      }
      {{/operations}}
    }
    {{/services}}
  }

  /**
   * Namespace containing socket related events
   */
  export namespace Events {
    ${eventModelContent}

    export interface ISocketEvent<P extends { [key: string]: any }, R> {
      subscribe(params: P, cb: (data: R) => void): this;
      unsubscribe(): void;
    }

    export abstract class SocketEvent<P extends { [key: string]: any }, R> {
      protected abstract path: string;
      private params: P;
      private callback: (data: R) => void;

      /**
       * Subscribe to this event
       * @param params Payload to submit to the server
       * @param cb Handler for event broadcasts
       */
      public subscribe(params: P, cb: (data: R) => void) {
        if (!hasWebSocket) {
          throw new Error('WebSockets not configured.');
        }

        this.params = params;
        this.callback = cb;

        const channel = this.getChannel(params);
        send(\`sub:\${channel}\`);

        const sub = subscriptions[channel];
        if (sub) {
          sub.callbacks.push(this.callback);
        } else {
          subscriptions[channel] = {
            callbacks: [this.callback],
            resub: () => {
              send(\`sub:\${channel}\`)
            },
            subActive: true
          };
        }

        return this;
      }

      /**
       * Dispose of an active subscription
       */
      public unsubscribe() {
        send(\`unsub:\${this.getChannel(this.params)}\`);
        subscriptions[this.getChannel(this.params)] = undefined;
      }

      private getChannel(params: P) {
        let channel = this.path;

        Object.keys(params).forEach(k => {
          channel = channel.replace(\`:\${k}\`, params[k]);
        });

        return channel.toLowerCase();
      }
    }
    {{#events}}
    export interface I{{operation}} extends ISocketEvent<{{params}}, {{returns}}> {};

    /**
     * {{description}}
     */
    export class {{operation}} extends SocketEvent<{{params}}, {{returns}}> implements I{{operation}} {
      protected path = '{{path}}';
    }
    {{/events}}
  }
}
`);

const stringifyNumberEnum = (enumValue: Array<any>) => enumValue.map(s => `${s}`).join(' | ');
const getTypeFromRef = ($ref: string) => {
  return `${$ref.replace('#/definitions/', '')}`;
};

const getPropertyTypeFromSwaggerProperty = (property: Swagger.ISchema): string => {
  if (!property) { return 'void'; }

  if (property.type) {
    if (property.type === 'integer' || property.format === 'double') {
      if (property.format === 'int64') { return 'string'; }
      if (property.enum) { return stringifyNumberEnum(property.enum); }

      return 'number';
    }
    if (property.type === 'boolean') { return 'boolean'; }
    if (property.type === 'string') {
      return property.format === 'date-time' ? 'Date' : 'string';
    }

    if (property.type === 'array') {
      const items = property.items as Swagger.ISchema;
      if (!items) { throw new Error(); }

      if (items.type) {
        return `any[]`;
      }

      return `${getTypeFromRef(items.$ref as string)}[]`;
    }
  }

  if (property.$ref) { return getTypeFromRef(property.$ref); }

  return 'any';
};

const getTypeScriptTypeFromSwaggerType = (schema: ISchema) => {
  if (schema.type === 'integer' || schema.type === 'number') {
    if (schema.enum) {
      return stringifyNumberEnum(schema.enum);
    }

    return 'number';
  }

  if (schema.type === 'boolean') { return 'boolean'; }
  if (schema.type === 'string') {
    return schema.format === 'date-time' ? 'Date' : 'string';
  }

  return undefined;
};

const getPropertyTypeFromSwaggerParameter = (parameter: Swagger.IBaseParameter): string => {
  const queryParameter = parameter as Swagger.IQueryParameter;
  if (queryParameter.type) {
    const tsType = getTypeScriptTypeFromSwaggerType(queryParameter as any);
    if (tsType) { return tsType; }
  }

  const bodyParameter = parameter as Swagger.IBodyParameter;
  const schema = bodyParameter.schema;
  if (schema) {
    if (schema.$ref) {
      return getTypeFromRef(schema.$ref);
    }

    if (schema.type === 'array') {
      const items = schema.items as Swagger.ISchema;
      if (items.$ref) { return `${getTypeFromRef(items.$ref as string)}[]`; }
      if (items.type) {
        const tsType = getTypeScriptTypeFromSwaggerType(items);
        if (tsType) { return `${tsType}[]`; }
      }
    }
  }

  return 'any';
};

const getNormalizedDefinitionKey = (key: string) => {
  if (key.includes('[]')) {
    return key;
  }

  return key.replace('[', '').replace(']', '');
};

const getTemplateView = (swagger: Swagger.ISpec, eventSchema: IEventsSchema): ITemplateView => {
  const definitions = swagger.definitions;
  if (!definitions) { throw new Error('No definitions.'); }

  const paths = swagger.paths;
  if (!paths) { throw new Error('No paths.'); }

  const serviceMap: { [serviceName: string]: ITemplateService } = {};
  Object.keys(paths)
    .forEach(pathKey => {
      const methods = ['get', 'post', 'delete', 'patch', 'put', 'options', 'head'];
      const path = paths[pathKey];

      Object.keys(path)
        .filter(operationKey => methods.find(m => m === operationKey))
        .forEach(operationKey => {
          const operation = (path as any)[operationKey] as Swagger.IOperation;
          if (!operation.operationId || !operation.tags) {
            throw new Error();
          }

          const tag = operation.tags[0];
          const service = serviceMap[tag] = serviceMap[tag] || { name: `${tag}Service`, operations: [] };

          let operationId = operation.operationId.replace('_', '');
          if (tag) {
            operationId = operationId.replace(tag, '');
          }

          const parameters = operation.parameters;
          const operationParameters = new Array<ITemplateOperationParameters>();

          // /api/{someParam}/{anotherParam} => /api/${someParam}/${anotherParam}
          let urlTemplate = `${pathKey}`.replace(/\{/g, '${');
          let signature = '';
          let paramsInterfaceName = '';
          let queryParameters: string[] | undefined = undefined;
          let bodyParameter: string | undefined;
          let hasBodyParameter = false;

          if (parameters && parameters.length) {
            paramsInterfaceName = `I${tag}${operationId.charAt(0).toUpperCase() + operationId.slice(1)}Params`;
            signature = `params: ${paramsInterfaceName}`;
            parameters.forEach(parameter => {
              const parameterName = parameter.name;

              operationParameters.push({
                parameterName: `${parameterName}${parameter.required === false ? '?' : ''}`,
                parameterType: getPropertyTypeFromSwaggerParameter(parameter),
                description: parameter.description
              });

              if (parameter.in === 'path') {
                urlTemplate = urlTemplate.replace(parameter.name, `params.${parameterName}`);
                return;
              }

              if (parameter.in === 'query') {
                queryParameters = queryParameters || new Array<string>();
                queryParameters.push(parameterName);
                return;
              }

              if (parameter.in === 'body') {
                hasBodyParameter = true;
                bodyParameter = parameterName;
              }
            });
            signature += ', headers?: IAdditionalHeaders';
          } else {
            signature = 'headers?: IAdditionalHeaders';
          }

          let returnType = 'void';
          if (operation.responses['200']) {
            returnType = getNormalizedDefinitionKey(getPropertyTypeFromSwaggerProperty(operation.responses['200'].schema as Swagger.ISchema));
          }

          service.operations.push({
            id: operationId.charAt(0).toLowerCase() + operationId.slice(1),
            method: operationKey.toUpperCase(),
            signature,
            urlTemplate,
            parameters: operationParameters,
            hasParameters: !!operationParameters.length,
            bodyParameter,
            queryParameters,
            returnType,
            paramsInterfaceName,
            hasBodyParameter,
            description: operation.description
          } as ITemplateOperation);
        });
    });

  return {
    events: eventSchema.events,
    baseUrl: baseApiUrl,
    apiPath: swagger.basePath as string,
    services: Object.keys(serviceMap).map(key => serviceMap[key]),
    models: Object.keys(definitions).map(definitionKey => {
      const definition = definitions[definitionKey];
      if (!definition) { throw new Error('No definition found.'); }

      const properties = definition.properties;
      if (!properties) {
        throw new Error('No definition properties found.');
      }

      return {
        name: `${getNormalizedDefinitionKey(definitionKey)}`,
        description: definition.description,
        properties: Object.keys(properties).map(propertyKey => {
          const property = properties[propertyKey];
          const isRequired = definition.required && definition.required.find(propertyName => propertyName === propertyKey);

          return {
            propertyName: `${propertyKey}${isRequired ? '' : '?'}`,
            propertyType: getPropertyTypeFromSwaggerProperty(property),
            description: property.description
          };
        })
      };
    })
  };
};

const replaceAll = (value: string, pattern: string, replacement: string) => {
  return value.split(pattern).join(replacement);
};

(async () => {
  // tslint:disable-next-line
  const spec = require('./swagger.json');

  // tslint:disable-next-line
  const eventSchema = require('./events.json') as IEventsSchema;

  let modelsContent = '/* tslint:disable */';

  for (const s of eventSchema.schema) {
    const content = await compile(s, s.title, {
      declareExternallyReferenced: true
    });

    modelsContent += content;
  }

  let eventModelContent = replaceAll(modelsContent, '[k: string]: any;', '');
  eventModelContent = replaceAll(eventModelContent, 'expirationDate: string;', 'expirationDate: Date;');
  eventModelContent = replaceAll(eventModelContent, 'dateCreated: string;', 'dateCreated: Date;');
  eventModelContent = replaceAll(eventModelContent, 'dateClosed: string;', 'dateClosed: Date;');
  eventModelContent = replaceAll(eventModelContent, 'dateUpdated: string;', 'dateUpdated: Date;');
  eventModelContent = replaceAll(eventModelContent, `/**
  * This file was automatically generated by json-schema-to-typescript.
  * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
  * and run json-schema-to-typescript to regenerate this file.
  */`, '');

  try {
    const compiled = template(eventModelContent)(getTemplateView(spec, eventSchema));
    fs.writeFileSync(`${__dirname}/src/generated/ercdex.ts`, compiled);
    console.log('Api file generated!');
  } catch (err) {
    console.log(err);
  }
})();
