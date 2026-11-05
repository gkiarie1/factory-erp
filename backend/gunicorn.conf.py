bind = '0.0.0.0:5000'
workers = 1  # Socket.IO long-polling requires one worker without a shared queue.
worker_class = 'gthread'
threads = 20
timeout = 60
graceful_timeout = 30
accesslog = '-'
errorlog = '-'
# Do not log query strings: password reset links contain sensitive tokens.
access_log_format = '%(h)s %(m)s %(U)s %(s)s %(L)s'
