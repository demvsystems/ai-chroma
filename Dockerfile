FROM python:3.10-slim-bookworm as builder

RUN apt-get update --fix-missing && apt-get install -y --fix-missing \
    build-essential \
    gcc \
    g++ && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir /install
WORKDIR /install

COPY ./requirements.txt requirements.txt

RUN pip install --no-cache-dir --upgrade --prefix="/install" -r requirements.txt

FROM python:3.10-slim-bookworm as final

RUN apt-get update --fix-missing && apt-get install -y --fix-missing \
    build-essential \
    gcc \
    g++ && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir /chroma
WORKDIR /chroma

COPY --from=builder /install /usr/local
COPY ./bin/docker_entrypoint.sh /docker_entrypoint.sh
COPY ./ /chroma

COPY sshd_config /etc/ssh/
RUN apt-get update && apt-get install -y \
    openssh-server && echo "root:Docker!" | chpasswd \
    && chmod u+x ./docker_entrypoint.sh

EXPOSE 8000 2222

CMD ["/docker_entrypoint.sh"]
