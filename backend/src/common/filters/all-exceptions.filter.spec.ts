import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { AllExceptionsFilter } from './all-exceptions.filter'

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
})

afterAll(() => {
  jest.restoreAllMocks()
})

function makeHost(mockRes: { status: jest.Mock; json: jest.Mock }, url: string) {
  return {
    switchToHttp: () => ({
      getResponse: () => mockRes,
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter()

  it('HttpException：合并 statusCode 与 path', () => {
    const status = jest.fn().mockReturnThis()
    const json = jest.fn()
    const host = makeHost({ status, json }, '/api/x')

    filter.catch(
      new HttpException({ message: 'bad' }, HttpStatus.BAD_REQUEST),
      host,
    )

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        path: '/api/x',
        message: 'bad',
      }),
    )
  })

  it('字符串型 HttpException 响应体', () => {
    const status = jest.fn().mockReturnThis()
    const json = jest.fn()
    const host = makeHost({ status, json }, '/p')

    filter.catch(new HttpException('gone', HttpStatus.GONE), host)

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 410,
        message: 'gone',
        path: '/p',
      }),
    )
  })

  it('非 HttpException → 500 与统一 message', () => {
    const status = jest.fn().mockReturnThis()
    const json = jest.fn()
    const host = makeHost({ status, json }, '/err')

    filter.catch(new Error('boom'), host)

    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        path: '/err',
      }),
    )
  })
})
