from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO


db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()
socketio = SocketIO(cors_allowed_origins=["http://localhost:3000"], logger=True, engineio_logger=True)
