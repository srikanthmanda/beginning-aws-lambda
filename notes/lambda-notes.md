# AWS Lambda

## [What is Lambda?](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html)

- Lambda is a serverless service.
- Lambda functions process events and are core to the Lambda service.
- Following are other components (or resources) related to Lambda service:
	- Event triggers that _push_ or send events, to be processed either synchronously or asynchronously.
	- Asynchronous event queues that hold events for asynchronous processing.
	- Event Source Mappings that Lambda polls or _pulls_ events from, often streams (Kinesis) and queues (SQS).
	- Destinations that can hold invocation records of the events.
	- Dead Letter Queues (DLQs) that can hold expired events and error events.

## [Asynchronous Invocation](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html)

- Invoking Lambda asynchronously is effectively writing an event to event queue.
- If the event is queued successfully, the Lambda service returns a **202** status code with no other details.
- After sending the response to the invoker, Lambda service passes the event to the Lambda function.
- Asynchronous invocation involves following components:
	1. Asynchronous event queue of the Lambda function.
	2. Lambda function.
	3. Destinations for invocation records.
	4. Dead Letter Queues (DLQs) for discarded events.
- Lambda service retries events in case of the errors.
- Lambda service retains events in the queue only for a certain period i.e., events have an expiry period.
- Lambda service may pass an event multiple times to the Lambda function because the queue is eventually consistent.

Following AWS services can invoke Lambda asynchronously: S3, SNS, SES, CloudFormation, CloudWatch Logs, CloudWatch Events, CodeCommit, Config, IoT, IoT Events, CodePipeline.

### Errors and Retries

- Requests are throttled (HTTP 429) if the number of queued events crosses the Lambda function's concurrency limit.
- Lambda service returns events that fail due to throttling (HTTP 429) and system (HTTP 5xx) errors to the event queue.
- Lambda service retries failed events two _more_ times i.e., thrice in total.
- Lambda service discards both failed events (after max retries) and expired events.

:question: How does an event fail with 5xx error?

### Destinations and Invocation Records

- Lambda service can record invocations and conditionally forward them to other AWS services configured as Destinations.
- Invocation record contains details about the request, including the event, and the response in JSON format.
- Successful and failed events can have separate destinations, configured using `On failure` and `On success` conditions.

Following AWS services can be destinations for asynchronous invocations: SQS, SNS, Lambda, EventBridge.

### Dead Letter Queues (DLQs)

- DLQs are an alternative to `On failure` invocation destination.
- Lambda service can send discarded events to DLQs.
- A discarded event is an event that failed all processing attempts or expired without being processed.
- Lambda service sends only the content of the event, without details about the response, to DLQs.

Following AWS services can be DLQ resources for asynchronous invocations: SQS, SNS.

## [Event Source Mapping](https://docs.aws.amazon.com/lambda/latest/dg/invocation-eventsourcemapping.html)

- Lambda service can process items from streams or queues, using event source mappings.
- An event source mapping reads items and sends them to Lambda function in batches.
- Each event i.e., a batch can contain hundreds or thousands of items.
- Lambda reads data from event source, creates events, and invokes Lambda function.
- Lambda function needs execution role specific to the service to read events from.

:warning: Default `BatchSize` is 10. Beware processing only the first record `Records[0]` of the event.

Lambda invocation though event source mapping involves following components:
1. Lambda function.
2. Destinations for discarded events invocation records.

Lambda service can poll events from following AWS services:
- [SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)
- [Kinesis](https://docs.aws.amazon.com/lambda/latest/dg/with-kinesis.html)
- [DynamoDB](https://docs.aws.amazon.com/lambda/latest/dg/with-ddb.html)
- [MSK](https://docs.aws.amazon.com/lambda/latest/dg/with-msk.html)

### Destinations with Event Source Mapping

- With event source mapping too, Lambda can be configured to send an invocation record to another service.
- However, with event source mapping, destination can be configured ONLY for discarded batches of events.
- The invocation record contains details of failed event batch in JSON format.

Following AWS services can be destinations for event source mappings: SQS, SNS.

### [SQS Integration](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)

- Lambda service reads SQS messages in batches and invokes Lambda function once for each batch.
- Messages read by Lambda stay in the queue, but are hidden for the length of the queue's visibility timeout.
- When Lambda function successfully processes a batch, Lambda service deletes that batch of messages from the queue.
- If the Lambda function is throttled, returns an error, or doesn't respond, the message becomes visible again.
- DLQ can be configured in the source SQS to handle messages that fail to be processed multiple times

:warning: DLQ should be configured on SQS, not the Lambda function (unlike with Async invocation).

## [Synchronous Invocation](https://docs.aws.amazon.com/lambda/latest/dg/invocation-sync.html)

- Invoking Lambda synchronously passes the event to the Lambda function directly, without any queuing.
- Invoker waits for the response from Lambda function and might retry on errors.
- Lambda service does NOT retry event failures.

Following AWS services can invoke Lambda synchronously: ELB (ALB), Cognito, Lex, Alexa, API Gateway, CloudFront (Lambda@Edge), Kinesis Data Firehose, S3 Batch.

## [Node.js Lambda Functions](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html)

- Code entry point is designated by `Handler` in the SAM/CloudFormation template.
- [Arguments of Node.js Handler functions](#arguments-of-nodejs-handler-functions):
	1. [Event](#event)
	2. [Context](#context)
	3. [Callback](#callback)

### Arguments of Node.js Handler Functions

#### Event

- First argument: Main input to the Lambda function.
- The invoker passes this as a JSON-formatted string.
- The runtime converts it to an object.

#### [Context](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html)

- Second argument: Information about the invocation, function, and execution environment.
- Context method:
	- `getRemainingTimeInMillis()`: Returns the number of milliseconds left before the execution times out.
- Context properties: `functionName`, `functionVersion`, `invokedFunctionArn`, `memoryLimitInMB`, `awsRequestId`, `logGroupName`, `logStreamName`, etc.

#### Callback

- Third argument: A function, for a non-asynchronous invocation to send response back.
- Takes two arguments:
	1. Error
	2. Response
- The response object must be compatible with `JSON.stringify`.

### Node.js Asynchronous Handlers

- The `handler` functions must use the `async` keyword.
- Instead of using callback like synchronous handlers, async handlers can send a response, error, or promise to the runtime.
- `return` sends a response and `throw` sends an error.
- Asynchronous tasks (e.g. a URL fetch) within the Lambda function should return a promise to make sure they finish running.
- Promise resolution sends response and promise rejection sends error, to the invoker.

### Node.js Synchronous Handlers

- For non-async handlers, function execution continues until the event loop is empty or the function times out.
- Response is sent to the invoker only after all event loop tasks are finished.
- Error is sent if the function times out.
- Setting `context.callbackWaitsForEmptyEventLoop` to `false` configures the runtime to send the response immediately.

## Points to Note

While concurrent executions of a Lambda function can be increased from default of 1000 to hundreds of thousands, using a Lambda with resources inside a VPC i.e., connecting the Lambda function to a VPC's subnets can impose an additional constraint with available IP addresses Lambda needs to create an Elastic Network Interface (ENIs). More information:
- [Quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)
- [Lambda and VPC](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html)
- [Function states](https://docs.aws.amazon.com/lambda/latest/dg/functions-states.html)

## References

- [Integration with other AWS services](https://docs.amazonaws.cn/en_us/lambda/latest/dg/lambda-services.html)
- [Best practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Lambda error handling](https://docs.aws.amazon.com/lambda/latest/dg/invocation-retries.html)
- [Securing environment variables](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html#configuration-envvars-encryption)
