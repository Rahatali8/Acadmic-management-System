from setuptools import setup, find_packages

setup(
    name="ams-shared",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "djangorestframework-simplejwt>=5.0.0",
        "pika>=1.3.0",
        "redis>=4.0.0",
    ],
)
