import { HttpClient } from '@angular/common/http';
import { Storage } from '@ionic/storage';

import { Injectable } from '@angular/core';

@Injectable()
export class UserAccountModule {
  private backend_host = 'http://46.219.125.69:5000';

  public check_user : boolean;

  public auth;

  public account_id: string;

  public email: string;
  public password: string;
  public verify_password: string;

  public name: string;
  public username: string;
  public legal_name: string;

  public country_code: string;
  public language_code: string;
  public timezone: string;

  private contracts: Array<Object>;

  constructor(private http: HttpClient, private storage: Storage) {
    console.log('UserAccountModule->constructor');
    this.country_code = 'US';
    this.language_code = 'eng';
    this.timezone = 'America/Los_Angeles';
  }

  public init() {
    return this.getUser();
  }

  private _request(sub_url, method, json, options) {
    return this
      .storage.get('auth')
      .then( (auth_str) => {
        const auth = JSON.parse(auth_str || '{}');
        if (!auth.email) {
          throw(new Error('NOT_LOGGED_IN1'));
        }
        this.auth = auth;
        if (!this.account_id) {
          // throw(new Error('NOT_LOGGED_IN2'));
          if (!this.check_user) {
            return this.logIn(auth.email, auth.password);
          }
        }
      })
      .then( () => {
        const url = [
          this.backend_host.replace(/\/+$/, ''),
          sub_url.replace(/^\/+/, '')
        ].join('/');
        let args = [url];
        if (!options) {
          options = {};
        }
        if (!options.headers) {
          options.headers = {};
        }
        if (!options.headers['Content-Type']) {
          options.headers['Content-Type'] = {};
        }
        options.headers['Authorization'] = 'Basic ' + btoa(
            unescape(encodeURIComponent(this.auth.email + ':' + this.auth.password))
        );
        options.headers['Content-Type'] = 'application/json';
        method = (method || 'get').toLowerCase();
        switch (method) {
          case 'get' : {
            args = args.concat([options]);
            break;
          }
          case 'post' : {
            args = args.concat([json, options]);
            break;
          }
        }
        if (!this.http[method]) {
          console.log('Error: No such HTTP method :', {url, method, json, options});
        }
        return this.http[method].apply(this.http, args).toPromise();
      })
      .then((response) => {
        if ((response.error || {}).message) {
          throw new Error([
            response.error.code,
            response.error.message
          ].join(': '));
        }
        console.log('HTTP_RESPONSE:', {method, options, response});
        return response;
      })
      .catch((error) => {
        console.log('HTTP_ERROR:', {method, options, error});
        throw(error);
      });
  }

  getUser() {
    if ( this.account_id ) {
      return null;
    }
    this.check_user = true;
    console.log('UserAccountModule->getUser');
    return this._request('/account/auth/', 'get', null, null)
        .then( (user) => {
          if ( !user.account_id ) {
            throw(new Error('FAILED_TO_LOGIN'));
          }

          this.account_id = user.account_id;
          this.email = user.email;
          this.password = user.password;
          this.verify_password = user.verify_password;
          this.name = user.name;
          this.username = user.username;
          this.legal_name = user.legal_name;
          this.country_code = user.country_code;
          this.language_code = user.language_code;
          this.timezone = user.timezone;
          this.contracts = user.contracts;

          console.log( this.account_id );

          return user;
        })
        .finally( () => {
          this.check_user = false;
        });
  }

  createUser() {
    const { account_id, email, username, password, legal_name, language_code, country_code, timezone } = this;
    const params = {account_id, email, username, password, legal_name, language_code, country_code, timezone};
    return this._request('/account', 'post', params, null)
        .then( () => {
          return this.getUser();
        });
  }

  async logIn(email, password) {
    this.auth = { email, password };
    await this.storage.set('auth', JSON.stringify({email, password}));
    return await this.getUser();
  }

  async logOut() {
    await this.storage.remove('auth');
    await this.storage.remove('user');
    return null;
  }

  getContracts() {
    return this._request('/contract/list/', 'get', null, null)
        .then(data => {
          this.contracts = data;
          return data;
        });
  }

  addContract(memo, body, to_account_id) {
    console.log('addContract', arguments);
    const { account_id } = this;
    const contract_body = { account_id, memo, body };
    return this._request('/contract/', 'post', contract_body, null)
        .then(data => {
          console.log('addContract-data', data);
          const { contract_id } = data;
          const dialog = [
            { account_id, contract_id }
          ];
          const parties = [
            { account_id, contract_id },
            { account_id : to_account_id, contract_id },
          ];
          const deal_body = { account_id, title : memo, dialog, parties };
          return this._request('/deal/', 'post', deal_body, null);
        });
  }

  listDrafts() {
    return this._request('/contract/list?type=draft', 'get', null, null);
  }
}
