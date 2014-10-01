/**
 * Created by jzabel on 9/30/14.
 */

var oauthModule = require('./oauth'),
    url = require('url'),
    request = require('request');

module.exports = oauthModule.submodule('hubspot')
  .configurable({
    portal_id: "The HubSpot portal ID of the customer that you're re-directing. You will need to get the portal ID from the customer who you're making the request for.",
    scope: "The scopes (or permissions) you want. These should match your app settings in the Marketplace. Separate more than one scope with "+" in your URL request."
  })

  .oauthHost('https://app.hubspot.com')
  .apiHost('https://api.hubapi.com')

  .entryPath('/hubspot/auth')
  .callbackPath('/hubspot/auth/callback')

  .requestTokenQueryParam({
    portalId: function() {
      return this._portal_id && this.portal_id();
    }
  })

  .authCallbackDidErr(function (req) {
    var parsedUrl = url.parse(req.url, true);
    return parsedUrl.query.error ? true : false;
  })

  .fetchOAuthUser(function (oauthToken, data) {
    var promise = this.Promise();

    var userUrl = this.apiHost() + '/users/me/';
    var queryParams = { token: oauthToken, format: "json" };

    request.get({ url: userUrl, qs: queryParams}, function (err, res, body) {
      if (err) {
        err.extra = {res: res, data: body};
        return promise.fail(err);
      }
      if (parseInt(res.statusCode / 100, 10) !== 2) {
        return promise.fail({data: body, res: res});
      }
      return promise.fulfill(JSON.parse(body));
    });
    return promise;
  })

  .handleAuthCallbackError( function (req, res, next) {
    var parsedUrl = url.parse(req.url, true),
        errorDesc = parsedUrl.query.error + "; " + parsedUrl.query.error_description;
    if (res.render) {
      res.render(__dirname + '/../views/auth-fail.jade', {
        errorDescription: errorDesc
      });
    } else {
      // TODO Replace this with a nice fallback
      throw new Error("You must configure handleAuthCallbackError if you are not using express");
    }
  })

  .moduleErrback( function (err, seqValues) {
    var serverResponse;
    if (err instanceof Error) {
      var next = seqValues.next;
      return next(err);
    } else if (err.extra) {
      var hubspotResponse = err.extra.res;
          serverResponse = seqValues.res;
      serverResponse.writeHead(
        hubspotResponse.statusCode,
        hubspotResponse.headers);
      serverResponse.end(err.extra.data);
    } else if (err.statusCode) {
      serverResponse = seqValues.res;
      serverResponse.writeHead(err.statusCode);
      serverResponse.end(err.data);
    } else {
      console.error(err);
      throw new Error('Unsupported error type');
    }
  });