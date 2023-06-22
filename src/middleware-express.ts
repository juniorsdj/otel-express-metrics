import { hrtime } from "node:process";

import { metrics, ValueType } from "@opentelemetry/api";
import { NextFunction, Request, Response } from "express";
import UrlValueParser from "url-value-parser";

const urlValueParser = new UrlValueParser();
const myMeter = metrics.getMeter("my-service-meter");

function requestCountGenerator(prefix = "") {
  return myMeter.createCounter(`${prefix}http_requests_total`, {
    description: "Counter for total requests received",
    valueType: ValueType.INT,
  });
}

function requestDurationGenerator(prefix = "") {
  return myMeter.createHistogram(`${prefix}http_request_duration_seconds`, {
    description: "Duration of HTTP requests in seconds",
    unit: "ms",
  });
}

function normalizePath(req: Request) {
  return urlValueParser.replacePathValues(req.originalUrl, "#val");
}

const requestCounter = requestCountGenerator();
const requestDuration = requestDurationGenerator();

export function middleware(req: Request, res: Response, next: NextFunction) {
  const normalizedPath = normalizePath(req);
  const { method } = req;

  const startAt = hrtime.bigint();

  res.on("finish", function () {
    const normalizedStatusCode = res.statusCode;
    const endAt = hrtime.bigint();

    const timeInNanoSeconds = endAt - startAt; //nanoseconds

    const time = Number(timeInNanoSeconds) / 1000000; //ms

    const labels = {
      method,
      path: normalizedPath,
      status: normalizedStatusCode,
    };

    requestDuration.record(time, labels);
    requestCounter.add(1, labels);
  });

  next();
}
