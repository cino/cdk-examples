import { PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import {
  ScheduledEvent, ScheduledHandler
} from 'aws-lambda';


const ssmClient = new SSMClient({
  region: process.env.AWS_REGION,
});

/**
 * This is the handler that is called every 5 minutes to rotate the secret.
 * it will update the secret value with the current date and time.
 *
 * In a real world example you would generate a new secret value and update the secret.
 */
export const handler: ScheduledHandler = async (
  event: ScheduledEvent,
): Promise<void> => {
  console.log(event);

  const parameterName = process.env.PARAMETER_NAME as string;

  await ssmClient.send(new PutParameterCommand({
    Name: parameterName,
    Value: new Date().toISOString(),
    Overwrite: true,
  }));

  return;
}
