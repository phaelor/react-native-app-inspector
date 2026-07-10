#import "AppInspectorURLProtocol.h"

#import <React/RCTHTTPRequestHandler.h>

static NSString *const kHandledKey = @"AppInspectorURLProtocolHandled";

static BOOL sEnabled = NO;
static AppInspectorNetworkHandler sHandler = nil;

@interface AppInspectorURLProtocol () <NSURLSessionDataDelegate>
@property(nonatomic, strong) NSURLSession *session;
@property(nonatomic, strong) NSURLSessionDataTask *task;
@property(nonatomic, assign) double startedAtMs;
@property(nonatomic, assign) NSInteger statusCode;
@end

@implementation AppInspectorURLProtocol

+ (void)load {
  RCTSetCustomNSURLSessionConfigurationProvider(^NSURLSessionConfiguration * {
    NSURLSessionConfiguration *config =
        [NSURLSessionConfiguration defaultSessionConfiguration];
    NSMutableArray *protocols =
        [NSMutableArray arrayWithObject:[AppInspectorURLProtocol class]];
    if (config.protocolClasses) {
      [protocols addObjectsFromArray:config.protocolClasses];
    }
    config.protocolClasses = protocols;
    return config;
  });
}

+ (void)setEnabled:(BOOL)enabled {
  @synchronized(self) {
    sEnabled = enabled;
  }
}

+ (void)setEventHandler:(nullable AppInspectorNetworkHandler)handler {
  @synchronized(self) {
    sHandler = [handler copy];
  }
}

+ (void)report:(NSDictionary *)entry {
  AppInspectorNetworkHandler handler;
  @synchronized(self) {
    handler = sHandler;
  }
  if (handler) {
    handler(entry);
  }
}

+ (BOOL)canInitWithRequest:(NSURLRequest *)request {
  if (!sEnabled) {
    return NO;
  }
  if ([NSURLProtocol propertyForKey:kHandledKey inRequest:request]) {
    return NO;
  }
  NSString *scheme = request.URL.scheme.lowercaseString;
  return [scheme isEqualToString:@"http"] || [scheme isEqualToString:@"https"];
}

+ (NSURLRequest *)canonicalRequestForRequest:(NSURLRequest *)request {
  return request;
}

- (void)startLoading {
  NSMutableURLRequest *request = [self.request mutableCopy];
  [NSURLProtocol setProperty:@YES forKey:kHandledKey inRequest:request];
  self.startedAtMs = [[NSDate date] timeIntervalSince1970] * 1000.0;
  self.statusCode = 0;
  self.session = [NSURLSession
      sessionWithConfiguration:[NSURLSessionConfiguration
                                   defaultSessionConfiguration]
                      delegate:self
                 delegateQueue:nil];
  self.task = [self.session dataTaskWithRequest:request];
  [self.task resume];
}

- (void)stopLoading {
  [self.task cancel];
  [self.session finishTasksAndInvalidate];
}

- (void)reportCompletion {
  NSMutableDictionary *entry = [NSMutableDictionary new];
  entry[@"method"] = self.request.HTTPMethod ?: @"GET";
  entry[@"url"] = self.request.URL.absoluteString ?: @"";
  entry[@"status"] = @(self.statusCode);
  entry[@"startedAt"] = @(self.startedAtMs);
  entry[@"durationMs"] =
      @([[NSDate date] timeIntervalSince1970] * 1000.0 - self.startedAtMs);
  [AppInspectorURLProtocol report:entry];
}

#pragma mark - NSURLSessionDataDelegate

- (void)URLSession:(NSURLSession *)session
              dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveResponse:(NSURLResponse *)response
     completionHandler:
         (void (^)(NSURLSessionResponseDisposition))completionHandler {
  if ([response isKindOfClass:[NSHTTPURLResponse class]]) {
    self.statusCode = ((NSHTTPURLResponse *)response).statusCode;
  }
  [self.client URLProtocol:self
        didReceiveResponse:response
        cacheStoragePolicy:NSURLCacheStorageNotAllowed];
  completionHandler(NSURLSessionResponseAllow);
}

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveData:(NSData *)data {
  [self.client URLProtocol:self didLoadData:data];
}

- (void)URLSession:(NSURLSession *)session
                          task:(NSURLSessionTask *)task
    willPerformHTTPRedirection:(NSHTTPURLResponse *)response
                    newRequest:(NSURLRequest *)request
             completionHandler:(void (^)(NSURLRequest *))completionHandler {
  NSMutableURLRequest *redirect = [request mutableCopy];
  [NSURLProtocol removePropertyForKey:kHandledKey inRequest:redirect];
  [self.client URLProtocol:self
      wasRedirectedToRequest:redirect
            redirectResponse:response];
  completionHandler(nil);
}

- (void)URLSession:(NSURLSession *)session
                    task:(NSURLSessionTask *)task
    didCompleteWithError:(NSError *)error {
  if (error) {
    if (!([error.domain isEqualToString:NSURLErrorDomain] &&
          error.code == NSURLErrorCancelled)) {
      [self reportCompletion];
      [self.client URLProtocol:self didFailWithError:error];
    }
  } else {
    [self reportCompletion];
    [self.client URLProtocolDidFinishLoading:self];
  }
  [self.session finishTasksAndInvalidate];
  self.session = nil;
  self.task = nil;
}

@end
