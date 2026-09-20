import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { HttpRequestDto } from 'src/dtos/common/http.request.dto';

@Injectable()
export class ProxyHttpService {
  private readonly logger = new Logger(ProxyHttpService.name);
  constructor(private readonly httpService: HttpService) {}

  async request<T>(request: HttpRequestDto): Promise<T> {
    try {
      this.logger.debug('making http request', request);

      const res = await this.httpService.axiosRef({
        method: request.method,
        url: request.url,
        headers: {
          ...request.headers,
          Authorization: `Bearer ${request.token}`,
        },
        params: request.params,
        data: request.data,
      });
      this.logger.debug('response from http request', res.data);
      return res.data as T;
    } catch (error) {
      // Axios's own error message ("Request failed with status code 400")
      // never includes the API's actual response body, which is where the
      // real reason lives (e.g. Paystack's {message, code}) - log it
      // explicitly, or every downstream failure is undiagnosable from logs
      // alone.
      if (isAxiosError(error)) {
        this.logger.error(
          `an error occurred while making http request to ${request.url}`,
          { status: error.response?.status, body: error.response?.data },
        );
      } else {
        this.logger.error('an error occurred while making http request', error);
      }
      throw error;
    }
  }
}
