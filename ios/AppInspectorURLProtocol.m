#import "AppInspectorURLProtocol.h"

#import <objc/runtime.h>

static NSString *const kHandledKey = @"AppInspectorURLProtocolHandled";

static BOOL sEnabled = NO;
static AppInspectorNetworkHandler sHandler = nil;

@interface AppInspectorURLProtocol ()
@property(nonatomic, strong) NSURLSessionDataTask *task;
@property(nonatomic, assign) double startedAtMs;
@property(nonatomic, assign) NSInteger statusCode;
@property(nonatomic, assign) BOOL redirected;
- (void)didReceiveResponse:(NSURLResponse *)response;
- (void)didLoadData:(NSData *)data;
- (void)wasRedirectedToRequest:(NSURLRequest *)request
                      response:(NSHTTPURLResponse *)response;
- (void)didCompleteWithError:(nullable NSError *)error;
@end

#pragma mark - Shared session

// One background NSURLSession for all intercepted requests. NSURLSession
// delegates are per session, not per task, so this proxy routes callbacks to
// the protocol instance that owns the task.
@interface AppInspectorSessionProxy : NSObject <NSURLSessionDataDelegate>
+ (instancetype)shared;
- (NSURLSessionDataTask *)startTask:(NSURLRequest *)request
                          forProtocol:(AppInspectorURLProtocol *)protocol;
- (void)forgetTask:(NSURLSessionTask *)task;
@end

@implementation AppInspectorSessionProxy {
  NSURLSession *_session;
  NSMutableDictionary<NSNumber *, AppInspectorURLProtocol *> *_owners;
  NSLock *_lock;
}

+ (instancetype)shared {
  static AppInspectorSessionProxy *instance;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    instance = [AppInspectorSessionProxy new];
  });
  return instance;
}

- (instancetype)init {
  if ((self = [super init])) {
    _owners = [NSMutableDictionary new];
    _lock = [NSLock new];
    NSOperationQueue *queue = [NSOperationQueue new];
    queue.maxConcurrentOperationCount = 1;
    // Our own session must not go through the protocol again.
    NSURLSessionConfiguration *config =
        [NSURLSessionConfiguration defaultSessionConfiguration];
    NSMutableArray *classes = [config.protocolClasses mutableCopy] ?: [NSMutableArray new];
    [classes removeObject:[AppInspectorURLProtocol class]];
    config.protocolClasses = classes;
    _session = [NSURLSession sessionWithConfiguration:config
                                             delegate:self
                                        delegateQueue:queue];
  }
  return self;
}

- (NSURLSessionDataTask *)startTask:(NSURLRequest *)request
                          forProtocol:(AppInspectorURLProtocol *)protocol {
  NSURLSessionDataTask *task = [_session dataTaskWithRequest:request];
  [_lock lock];
  _owners[@(task.taskIdentifier)] = protocol;
  [_lock unlock];
  [task resume];
  return task;
}

- (AppInspectorURLProtocol *)ownerOf:(NSURLSessionTask *)task {
  [_lock lock];
  AppInspectorURLProtocol *owner = _owners[@(task.taskIdentifier)];
  [_lock unlock];
  return owner;
}

- (void)forgetTask:(NSURLSessionTask *)task {
  [_lock lock];
  [_owners removeObjectForKey:@(task.taskIdentifier)];
  [_lock unlock];
}

- (void)URLSession:(NSURLSession *)session
              dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveResponse:(NSURLResponse *)response
     completionHandler:
         (void (^)(NSURLSessionResponseDisposition))completionHandler {
  [[self ownerOf:dataTask] didReceiveResponse:response];
  completionHandler(NSURLSessionResponseAllow);
}

- (void)URLSession:(NSURLSession *)session
          dataTask:(NSURLSessionDataTask *)dataTask
    didReceiveData:(NSData *)data {
  [[self ownerOf:dataTask] didLoadData:data];
}

- (void)URLSession:(NSURLSession *)session
                          task:(NSURLSessionTask *)task
    willPerformHTTPRedirection:(NSHTTPURLResponse *)response
                    newRequest:(NSURLRequest *)request
             completionHandler:(void (^)(NSURLRequest *))completionHandler {
  [[self ownerOf:task] wasRedirectedToRequest:request response:response];
  // The client re-issues the redirected request itself.
  completionHandler(nil);
}

- (void)URLSession:(NSURLSession *)session
                    task:(NSURLSessionTask *)task
    didCompleteWithError:(NSError *)error {
  AppInspectorURLProtocol *owner = [self ownerOf:task];
  [self forgetTask:task];
  [owner didCompleteWithError:error];
}

@end

#pragma mark - Protocol registration

// Sessions consult `protocolClasses` of their configuration when created.
// Prepending ourselves there (instead of replacing RN's session configuration
// provider, which a host may also set) instruments RN's session and any
// other default/ephemeral session created after load, without overriding
// anything the host configured.
static NSArray *AppInspectorProtocolClasses(id self, SEL _cmd);
static IMP sOriginalProtocolClasses = NULL;

static NSArray *AppInspectorProtocolClasses(id self, SEL _cmd) {
  NSArray *original =
      ((NSArray * (*)(id, SEL)) sOriginalProtocolClasses)(self, _cmd);
  Class protocol = [AppInspectorURLProtocol class];
  if ([original containsObject:protocol]) {
    return original;
  }
  NSMutableArray *classes = [NSMutableArray arrayWithObject:protocol];
  if (original) {
    [classes addObjectsFromArray:original];
  }
  return classes;
}

static void AppInspectorInstallProtocolClassesHook(void) {
  // Concrete class of the class cluster (e.g. __NSCFURLSessionConfiguration).
  Class target = [[NSURLSessionConfiguration defaultSessionConfiguration] class];
  SEL selector = @selector(protocolClasses);
  Method method = class_getInstanceMethod(target, selector);
  if (!method) {
    return;
  }
  sOriginalProtocolClasses = method_getImplementation(method);
  const char *types = method_getTypeEncoding(method);
  // Add on the concrete class first so a superclass implementation is not
  // replaced for every subclass; fall back to replacing when it exists there.
  if (!class_addMethod(target, selector, (IMP)AppInspectorProtocolClasses,
                       types)) {
    method_setImplementation(method, (IMP)AppInspectorProtocolClasses);
  }
}

@implementation AppInspectorURLProtocol

+ (void)load {
  AppInspectorInstallProtocolClassesHook();
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
  self.redirected = NO;
  self.task = [[AppInspectorSessionProxy shared] startTask:request
                                                forProtocol:self];
}

- (void)stopLoading {
  if (self.task) {
    [[AppInspectorSessionProxy shared] forgetTask:self.task];
    [self.task cancel];
    self.task = nil;
  }
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

#pragma mark - Task callbacks (from the session proxy)

- (void)didReceiveResponse:(NSURLResponse *)response {
  if (self.redirected) {
    return;
  }
  if ([response isKindOfClass:[NSHTTPURLResponse class]]) {
    self.statusCode = ((NSHTTPURLResponse *)response).statusCode;
  }
  [self.client URLProtocol:self
        didReceiveResponse:response
          cacheStoragePolicy:NSURLCacheStorageNotAllowed];
}

- (void)didLoadData:(NSData *)data {
  if (self.redirected) {
    return;
  }
  [self.client URLProtocol:self didLoadData:data];
}

// The client re-issues the redirected request (captured as its own entry),
// so this hop ends here: log it with its 3xx status and drop the task.
- (void)wasRedirectedToRequest:(NSURLRequest *)request
                      response:(NSHTTPURLResponse *)response {
  self.redirected = YES;
  self.statusCode = response.statusCode;
  [self reportCompletion];
  [self stopLoading];
  NSMutableURLRequest *redirect = [request mutableCopy];
  [NSURLProtocol removePropertyForKey:kHandledKey inRequest:redirect];
  [self.client URLProtocol:self
      wasRedirectedToRequest:redirect
            redirectResponse:response];
}

- (void)didCompleteWithError:(nullable NSError *)error {
  self.task = nil;
  if (self.redirected) {
    return;
  }
  if (error) {
    if ([error.domain isEqualToString:NSURLErrorDomain] &&
        error.code == NSURLErrorCancelled) {
      return;
    }
    [self reportCompletion];
    [self.client URLProtocol:self didFailWithError:error];
  } else {
    [self reportCompletion];
    [self.client URLProtocolDidFinishLoading:self];
  }
}

@end
