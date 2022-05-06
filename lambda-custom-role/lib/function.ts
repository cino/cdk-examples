import { APIGatewayEventRequestContext, APIGatewayProxyEvent } from 'aws-lambda';
export async function handler(
    event: APIGatewayProxyEvent,
    context: APIGatewayEventRequestContext,
    callback: any,
): Promise<void> {
    console.log('log entry.');
}
