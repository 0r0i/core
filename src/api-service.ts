import * as moment from 'moment';
import * as request from 'superagent';

export interface IRequestParams {
  method: string;
  url: string;
  queryParameters?: { [key: string]: string | boolean | number | Date | undefined };
  apiKeyId?: string;
  body?: Object;
}

export interface IAdditionalHeaders {
  [key: string]: any;
}

export abstract class ApiService {
  protected executeRequest<T>(params: IRequestParams, headers?: IAdditionalHeaders) {
    return new Promise<T>((resolve, reject) => {
      let req = request(params.method, params.url)
        .set('Content-Type', 'application/json');

      if (params.apiKeyId) {
        req = req.set('X-API-KEY-ID', params.apiKeyId);
      }

      if (headers) {
        Object.keys(headers).forEach(key => {
          req = req.set(key, headers[key]);
        });
      }

      const queryParameters = params.queryParameters;
      if (queryParameters) {
        Object.keys(queryParameters).forEach(key => {
          const value = queryParameters[key];
          if (Object.prototype.toString.call(value) === '[object Date]') {
            queryParameters[key] = moment(value as Date).format();
          }
        });

        req = req.query(queryParameters);
      }
      if (params.body) { req.send(params.body); }

      req.end((error: any, response: any) => {
        if (error || !response.ok) {
          if (response && response.body) {
            const customError: any = new Error(response.body.message);
            customError.status = response.body.status;
            customError.type = response.body.type;
            reject(customError);
            return;
          }

          reject(error);
        } else {
          resolve(response.body);
        }
      });
    });
  }
}
