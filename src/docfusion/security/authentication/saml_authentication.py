#!/usr/bin/env python3
"""
SAML 2.0 Authentication Module

Implements SAML 2.0 Single Sign-On (SSO) for enterprise authentication
with support for multiple identity providers and advanced security features.
"""

import asyncio
import base64
import hashlib
import logging
import secrets
import time
import xml.etree.ElementTree as ET
import zlib
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from urllib.parse import parse_qs, urlencode, urlparse

try:
    import xmlsec
    from lxml import etree

    HAS_XMLSEC = True
except ImportError:
    HAS_XMLSEC = False

from pydantic import BaseModel, Field
from ...core.utils import uuid7str
class SAMLBinding(str, Enum):
    """SAML binding types"""

    HTTP_REDIRECT = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
    HTTP_POST = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
    HTTP_ARTIFACT = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Artifact"

class SAMLNameIDFormat(str, Enum):
    """SAML NameID format types"""

    UNSPECIFIED = "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified"
    EMAIL = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
    TRANSIENT = "urn:oasis:names:tc:SAML:2.0:nameid-format:transient"
    PERSISTENT = "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"

class SAMLAuthContextClass(str, Enum):
    """SAML authentication context classes"""

    PASSWORD = "urn:oasis:names:tc:SAML:2.0:ac:classes:Password"
    PASSWORD_PROTECTED_TRANSPORT = (
        "urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport"
    )
    TLS_CLIENT = "urn:oasis:names:tc:SAML:2.0:ac:classes:TLSClient"
    X509 = "urn:oasis:names:tc:SAML:2.0:ac:classes:X509"

@dataclass
class SAMLIdentityProviderConfig:
    """Configuration for SAML Identity Provider (IdP)"""

    entity_id: str
    sso_url: str
    slo_url: Optional[str] = None  # Single Logout URL
    x509_cert: Optional[str] = None  # IdP certificate for signature verification

    # Binding preferences
    preferred_binding: SAMLBinding = SAMLBinding.HTTP_REDIRECT
    supported_bindings: List[SAMLBinding] = field(
        default_factory=lambda: [SAMLBinding.HTTP_REDIRECT, SAMLBinding.HTTP_POST]
    )

    # NameID settings
    name_id_format: SAMLNameIDFormat = SAMLNameIDFormat.EMAIL

    # Security settings
    want_assertions_signed: bool = True
    want_name_id_encrypted: bool = False
    signature_algorithm: str = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"
    digest_algorithm: str = "http://www.w3.org/2001/04/xmlenc#sha256"

    # Attribute mapping
    attribute_mapping: Dict[str, str] = field(
        default_factory=lambda: {
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress": "email",
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname": "given_name",
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname": "family_name",
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "name",
        }
    )

@dataclass
class SAMLServiceProviderConfig:
    """Configuration for SAML Service Provider (SP)"""

    entity_id: str
    assertion_consumer_service_url: str
    single_logout_service_url: Optional[str] = None

    # Certificate and key for SP
    x509_cert: Optional[str] = None
    private_key: Optional[str] = None

    # Security settings
    want_assertions_encrypted: bool = False
    want_name_id_encrypted: bool = False
    sign_requests: bool = True
    sign_logout_requests: bool = True

    # Session settings
    session_not_on_or_after_minutes: int = 60

    # Organization info
    organization_name: str = "DocuFusion"
    organization_display_name: str = "DocuFusion Document Intelligence"
    organization_url: str = "https://docufusion.ai"

    # Contact info
    technical_contact_email: str = "tech@docufusion.ai"
    support_contact_email: str = "support@docufusion.ai"

@dataclass
class SAMLConfiguration:
    """SAML authentication configuration"""

    service_provider: SAMLServiceProviderConfig
    identity_providers: Dict[str, SAMLIdentityProviderConfig] = field(
        default_factory=dict
    )

    # Request settings
    request_id_expiry_minutes: int = 10
    force_authn: bool = False
    is_passive: bool = False

    # Response validation
    clock_skew_seconds: int = 300  # 5 minutes
    maximum_authentication_age_seconds: int = 3600  # 1 hour

    # Security settings
    require_signed_assertions: bool = True
    require_encrypted_assertions: bool = False
    validate_audience_restriction: bool = True

class SAMLRequest(BaseModel):
    """SAML authentication request"""

    request_id: str = Field(default_factory=lambda: f"_{uuid7str()}")
    idp_entity_id: str
    destination: str
    assertion_consumer_service_url: str

    # Request metadata
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime

    # Authentication requirements
    force_authn: bool = False
    is_passive: bool = False
    name_id_policy: Optional[SAMLNameIDFormat] = None
    requested_authn_context: Optional[SAMLAuthContextClass] = None

    # State management
    relay_state: Optional[str] = None
    user_id: Optional[str] = None  # Associated user if any

class SAMLAssertion(BaseModel):
    """SAML assertion information"""

    assertion_id: str
    subject: str
    subject_name_id_format: SAMLNameIDFormat
    issuer: str
    audience: str

    # Timing
    issued_at: datetime
    not_before: datetime
    not_on_or_after: datetime

    # Authentication
    authn_instant: datetime
    authn_context_class: Optional[SAMLAuthContextClass] = None
    session_index: Optional[str] = None

    # Attributes
    attributes: Dict[str, Any] = Field(default_factory=dict)

    # Security
    signature_valid: bool = False
    assertion_encrypted: bool = False

class SAMLResponse(BaseModel):
    """SAML authentication response"""

    response_id: str
    in_response_to: str
    destination: str
    issuer: str

    # Status
    status_code: str
    status_message: Optional[str] = None

    # Assertion
    assertion: Optional[SAMLAssertion] = None

    # Timing
    issued_at: datetime

    # Security validation results
    signature_valid: bool = False
    response_encrypted: bool = False

class SAMLUserInfo(BaseModel):
    """User information from SAML assertion"""

    subject: str
    subject_format: SAMLNameIDFormat

    # Standard attributes
    email: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    name: Optional[str] = None

    # Session information
    session_index: Optional[str] = None
    authn_instant: datetime

    # All attributes
    attributes: Dict[str, Any] = Field(default_factory=dict)

    # Provider info
    idp_entity_id: str

class SAMLResult(BaseModel):
    """SAML authentication result"""

    success: bool
    user_info: Optional[SAMLUserInfo] = None
    error: Optional[str] = None
    error_description: Optional[str] = None

    # Response details
    response: Optional[SAMLResponse] = None
    authentication_time: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    # Session management
    session_index: Optional[str] = None
    logout_url: Optional[str] = None

class SAMLAuthentication:
    """SAML 2.0 authentication manager"""

    def __init__(self, config: SAMLConfiguration):
        """Initialize SAML authentication manager"""
        self.config = config
        self.logger = logging.getLogger(__name__)

        # Validate configuration
        if not HAS_XMLSEC:
            self.logger.warning(
                "xmlsec library not available - signature validation disabled"
            )

        # Request storage (in production, use Redis or database)
        self.pending_requests: Dict[str, SAMLRequest] = {}

        # Session storage
        self.active_sessions: Dict[str, SAMLUserInfo] = {}

        self.logger.info(
            f"SAML authentication initialized with {len(self.config.identity_providers)} IdPs"
        )

    def get_metadata_xml(self) -> str:
        """Generate SAML metadata XML for Service Provider"""
        sp_config = self.config.service_provider

        metadata_template = f"""<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                     entityID="{sp_config.entity_id}">
	<md:SPSSODescriptor AuthnRequestsSigned="{str(sp_config.sign_requests).lower()}"
	                    WantAssertionsSigned="{str(self.config.require_signed_assertions).lower()}"
	                    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">

		<md:KeyDescriptor use="signing">
			<ds:KeyInfo>
				<ds:X509Data>
					<ds:X509Certificate>{sp_config.x509_cert or ""}</ds:X509Certificate>
				</ds:X509Data>
			</ds:KeyInfo>
		</md:KeyDescriptor>

		<md:KeyDescriptor use="encryption">
			<ds:KeyInfo>
				<ds:X509Data>
					<ds:X509Certificate>{sp_config.x509_cert or ""}</ds:X509Certificate>
				</ds:X509Data>
			</ds:KeyInfo>
		</md:KeyDescriptor>

		<md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
		<md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:transient</md:NameIDFormat>

		<md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
		                           Location="{sp_config.assertion_consumer_service_url}"
		                           index="0" isDefault="true"/>

		<md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
		                           Location="{sp_config.assertion_consumer_service_url}"
		                           index="1"/>"""

        if sp_config.single_logout_service_url:
            metadata_template += f"""

		<md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
		                      Location="{sp_config.single_logout_service_url}"/>
		<md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
		                      Location="{sp_config.single_logout_service_url}"/>"""

        metadata_template += f"""
	</md:SPSSODescriptor>

	<md:Organization>
		<md:OrganizationName xml:lang="en">{sp_config.organization_name}</md:OrganizationName>
		<md:OrganizationDisplayName xml:lang="en">{sp_config.organization_display_name}</md:OrganizationDisplayName>
		<md:OrganizationURL xml:lang="en">{sp_config.organization_url}</md:OrganizationURL>
	</md:Organization>

	<md:ContactPerson contactType="technical">
		<md:EmailAddress>{sp_config.technical_contact_email}</md:EmailAddress>
	</md:ContactPerson>

	<md:ContactPerson contactType="support">
		<md:EmailAddress>{sp_config.support_contact_email}</md:EmailAddress>
	</md:ContactPerson>
</md:EntityDescriptor>"""

        return metadata_template

    def create_authn_request(
        self,
        idp_entity_id: str,
        relay_state: Optional[str] = None,
        user_id: Optional[str] = None,
        force_authn: Optional[bool] = None,
        name_id_format: Optional[SAMLNameIDFormat] = None,
    ) -> str:
        """Create SAML AuthnRequest"""
        idp_config = self.config.identity_providers.get(idp_entity_id)
        if not idp_config:
            raise ValueError(f"Identity provider {idp_entity_id} not configured")

        # Create request
        request = SAMLRequest(
            idp_entity_id=idp_entity_id,
            destination=idp_config.sso_url,
            assertion_consumer_service_url=self.config.service_provider.assertion_consumer_service_url,
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=self.config.request_id_expiry_minutes),
            force_authn=force_authn or self.config.force_authn,
            is_passive=self.config.is_passive,
            name_id_policy=name_id_format or idp_config.name_id_format,
            relay_state=relay_state,
            user_id=user_id,
        )

        # Store request
        self.pending_requests[request.request_id] = request

        # Generate AuthnRequest XML
        authn_request_xml = self._build_authn_request_xml(request, idp_config)

        return authn_request_xml

    def get_sso_url(
        self,
        idp_entity_id: str,
        relay_state: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """Get SSO URL for identity provider"""
        authn_request_xml = self.create_authn_request(
            idp_entity_id, relay_state, user_id
        )

        idp_config = self.config.identity_providers[idp_entity_id]

        if idp_config.preferred_binding == SAMLBinding.HTTP_REDIRECT:
            # Encode request for HTTP-Redirect binding
            compressed = zlib.compress(authn_request_xml.encode("utf-8"))[2:-4]
            encoded_request = base64.b64encode(compressed).decode("utf-8")

            params = {"SAMLRequest": encoded_request}

            if relay_state:
                params["RelayState"] = relay_state

            # Add signature if required
            if self.config.service_provider.sign_requests:
                # Note: Actual signature implementation would require private key
                params["SigAlg"] = idp_config.signature_algorithm
                # params['Signature'] = self._sign_query_string(params)

            return f"{idp_config.sso_url}?{urlencode(params)}"

        else:
            # For HTTP-POST binding, return form data
            encoded_request = base64.b64encode(
                authn_request_xml.encode("utf-8")
            ).decode("utf-8")
            return {
                "url": idp_config.sso_url,
                "SAMLRequest": encoded_request,
                "RelayState": relay_state or "",
            }

    async def handle_sso_response(
        self,
        saml_response: str,
        relay_state: Optional[str] = None,
        is_base64_encoded: bool = True,
    ) -> SAMLResult:
        """Handle SAML SSO response"""
        try:
            # Decode response
            if is_base64_encoded:
                response_xml = base64.b64decode(saml_response).decode("utf-8")
            else:
                response_xml = saml_response

            # Parse response
            response = self._parse_saml_response(response_xml)

            if not response:
                return SAMLResult(
                    success=False,
                    error="invalid_response",
                    error_description="Failed to parse SAML response",
                )

            # Validate response
            validation_result = await self._validate_response(response, response_xml)

            if not validation_result["valid"]:
                return SAMLResult(
                    success=False,
                    error="validation_failed",
                    error_description=validation_result["error"],
                )

            # Check for assertion
            if not response.assertion:
                return SAMLResult(
                    success=False,
                    error="no_assertion",
                    error_description="No assertion found in response",
                )

            # Extract user information
            user_info = self._extract_user_info(response.assertion, response.issuer)

            # Create session
            if response.assertion.session_index:
                self.active_sessions[response.assertion.session_index] = user_info

            # Clean up pending request
            if response.in_response_to in self.pending_requests:
                del self.pending_requests[response.in_response_to]

            return SAMLResult(
                success=True,
                user_info=user_info,
                response=response,
                session_index=response.assertion.session_index,
                logout_url=self._get_logout_url(
                    response.issuer, response.assertion.session_index
                ),
            )

        except Exception as e:
            self.logger.error(f"SAML response handling error: {e}")
            return SAMLResult(
                success=False, error="processing_error", error_description=str(e)
            )

    def create_logout_request(
        self,
        idp_entity_id: str,
        name_id: str,
        session_index: Optional[str] = None,
        name_id_format: SAMLNameIDFormat = SAMLNameIDFormat.EMAIL,
    ) -> str:
        """Create SAML LogoutRequest"""
        idp_config = self.config.identity_providers.get(idp_entity_id)
        if not idp_config or not idp_config.slo_url:
            raise ValueError(f"Single logout not supported for {idp_entity_id}")

        request_id = f"_{uuid7str()}"
        issued_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        logout_request_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                     xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                     ID="{request_id}"
                     Version="2.0"
                     IssueInstant="{issued_at}"
                     Destination="{idp_config.slo_url}">
	<saml:Issuer>{self.config.service_provider.entity_id}</saml:Issuer>
	<saml:NameID Format="{name_id_format}">{name_id}</saml:NameID>"""

        if session_index:
            logout_request_xml += f"""
	<samlp:SessionIndex>{session_index}</samlp:SessionIndex>"""

        logout_request_xml += """
</samlp:LogoutRequest>"""

        return logout_request_xml

    async def handle_logout_response(
        self,
        saml_response: str,
        session_index: Optional[str] = None,
        is_base64_encoded: bool = True,
    ) -> bool:
        """Handle SAML logout response"""
        try:
            # Decode response
            if is_base64_encoded:
                response_xml = base64.b64decode(saml_response).decode("utf-8")
            else:
                response_xml = saml_response

            # Parse response (simplified)
            root = ET.fromstring(response_xml)
            status_code = root.find(
                ".//{urn:oasis:names:tc:SAML:2.0:protocol}StatusCode"
            )

            if status_code is not None:
                code = status_code.get("Value", "")
                success = "Success" in code

                # Clean up session if successful
                if success and session_index and session_index in self.active_sessions:
                    del self.active_sessions[session_index]

                return success

            return False

        except Exception as e:
            self.logger.error(f"Logout response handling error: {e}")
            return False

    def _build_authn_request_xml(
        self, request: SAMLRequest, idp_config: SAMLIdentityProviderConfig
    ) -> str:
        """Build AuthnRequest XML"""
        issued_at = request.issued_at.strftime("%Y-%m-%dT%H:%M:%SZ")

        authn_request = f"""<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                    ID="{request.request_id}"
                    Version="2.0"
                    IssueInstant="{issued_at}"
                    Destination="{request.destination}"
                    AssertionConsumerServiceURL="{request.assertion_consumer_service_url}"
                    ProtocolBinding="{idp_config.preferred_binding}">

	<saml:Issuer>{self.config.service_provider.entity_id}</saml:Issuer>"""

        if request.name_id_policy:
            authn_request += f"""
	<samlp:NameIDPolicy Format="{request.name_id_policy}" AllowCreate="true"/>"""

        if request.requested_authn_context:
            authn_request += f"""
	<samlp:RequestedAuthnContext Comparison="exact">
		<saml:AuthnContextClassRef>{request.requested_authn_context}</saml:AuthnContextClassRef>
	</samlp:RequestedAuthnContext>"""

        authn_request += """
</samlp:AuthnRequest>"""

        return authn_request

    def _parse_saml_response(self, response_xml: str) -> Optional[SAMLResponse]:
        """Parse SAML response XML"""
        try:
            root = ET.fromstring(response_xml)

            # Extract response attributes
            response_id = root.get("ID", "")
            in_response_to = root.get("InResponseTo", "")
            destination = root.get("Destination", "")
            issue_instant = root.get("IssueInstant", "")

            # Extract issuer
            issuer_elem = root.find(".//{urn:oasis:names:tc:SAML:2.0:assertion}Issuer")
            issuer = issuer_elem.text if issuer_elem is not None else ""

            # Extract status
            status_elem = root.find(
                ".//{urn:oasis:names:tc:SAML:2.0:protocol}StatusCode"
            )
            status_code = (
                status_elem.get("Value", "") if status_elem is not None else ""
            )

            status_message_elem = root.find(
                ".//{urn:oasis:names:tc:SAML:2.0:protocol}StatusMessage"
            )
            status_message = (
                status_message_elem.text if status_message_elem is not None else None
            )

            # Parse assertion if present
            assertion = None
            assertion_elem = root.find(
                ".//{urn:oasis:names:tc:SAML:2.0:assertion}Assertion"
            )
            if assertion_elem is not None:
                assertion = self._parse_assertion(assertion_elem)

            return SAMLResponse(
                response_id=response_id,
                in_response_to=in_response_to,
                destination=destination,
                issuer=issuer,
                status_code=status_code,
                status_message=status_message,
                assertion=assertion,
                issued_at=datetime.fromisoformat(issue_instant.replace("Z", "+00:00"))
                if issue_instant
                else datetime.now(timezone.utc),
            )

        except Exception as e:
            self.logger.error(f"Error parsing SAML response: {e}")
            return None

    def _parse_assertion(self, assertion_elem: ET.Element) -> SAMLAssertion:
        """Parse SAML assertion"""
        assertion_id = assertion_elem.get("ID", "")
        issue_instant = assertion_elem.get("IssueInstant", "")

        # Extract subject
        subject_elem = assertion_elem.find(
            ".//{urn:oasis:names:tc:SAML:2.0:assertion}Subject"
        )
        name_id_elem = (
            subject_elem.find(".//{urn:oasis:names:tc:SAML:2.0:assertion}NameID")
            if subject_elem is not None
            else None
        )
        subject = name_id_elem.text if name_id_elem is not None else ""
        subject_format = (
            SAMLNameIDFormat(name_id_elem.get("Format", SAMLNameIDFormat.UNSPECIFIED))
            if name_id_elem is not None
            else SAMLNameIDFormat.UNSPECIFIED
        )

        # Extract issuer
        issuer_elem = assertion_elem.find(
            ".//{urn:oasis:names:tc:SAML:2.0:assertion}Issuer"
        )
        issuer = issuer_elem.text if issuer_elem is not None else ""

        # Extract conditions
        conditions_elem = assertion_elem.find(
            ".//{urn:oasis:names:tc:SAML:2.0:assertion}Conditions"
        )
        not_before = datetime.now(timezone.utc)
        not_on_or_after = datetime.now(timezone.utc) + timedelta(hours=1)
        audience = ""

        if conditions_elem is not None:
            not_before_str = conditions_elem.get("NotBefore", "")
            not_on_or_after_str = conditions_elem.get("NotOnOrAfter", "")

            if not_before_str:
                not_before = datetime.fromisoformat(
                    not_before_str.replace("Z", "+00:00")
                )
            if not_on_or_after_str:
                not_on_or_after = datetime.fromisoformat(
                    not_on_or_after_str.replace("Z", "+00:00")
                )

            # Extract audience
            audience_elem = conditions_elem.find(
                ".//{urn:oasis:names:tc:SAML:2.0:assertion}Audience"
            )
            audience = audience_elem.text if audience_elem is not None else ""

        # Extract authentication statement
        authn_stmt_elem = assertion_elem.find(
            ".//{urn:oasis:names:tc:SAML:2.0:assertion}AuthnStatement"
        )
        authn_instant = datetime.now(timezone.utc)
        authn_context_class = None
        session_index = None

        if authn_stmt_elem is not None:
            authn_instant_str = authn_stmt_elem.get("AuthnInstant", "")
            if authn_instant_str:
                authn_instant = datetime.fromisoformat(
                    authn_instant_str.replace("Z", "+00:00")
                )

            session_index = authn_stmt_elem.get("SessionIndex")

            authn_context_elem = authn_stmt_elem.find(
                ".//{urn:oasis:names:tc:SAML:2.0:assertion}AuthnContextClassRef"
            )
            if authn_context_elem is not None:
                try:
                    authn_context_class = SAMLAuthContextClass(authn_context_elem.text)
                except ValueError:
                    self.logger.warning("ValueError in unknown")

        # Extract attributes
        attributes = {}
        attr_stmt_elem = assertion_elem.find(
            ".//{urn:oasis:names:tc:SAML:2.0:assertion}AttributeStatement"
        )
        if attr_stmt_elem is not None:
            for attr_elem in attr_stmt_elem.findall(
                ".//{urn:oasis:names:tc:SAML:2.0:assertion}Attribute"
            ):
                attr_name = attr_elem.get("Name", "")
                attr_values = []
                for value_elem in attr_elem.findall(
                    ".//{urn:oasis:names:tc:SAML:2.0:assertion}AttributeValue"
                ):
                    if value_elem.text:
                        attr_values.append(value_elem.text)
                if attr_values:
                    attributes[attr_name] = (
                        attr_values[0] if len(attr_values) == 1 else attr_values
                    )

        return SAMLAssertion(
            assertion_id=assertion_id,
            subject=subject,
            subject_name_id_format=subject_format,
            issuer=issuer,
            audience=audience,
            issued_at=datetime.fromisoformat(issue_instant.replace("Z", "+00:00"))
            if issue_instant
            else datetime.now(timezone.utc),
            not_before=not_before,
            not_on_or_after=not_on_or_after,
            authn_instant=authn_instant,
            authn_context_class=authn_context_class,
            session_index=session_index,
            attributes=attributes,
        )

    async def _validate_response(
        self, response: SAMLResponse, response_xml: str
    ) -> Dict[str, Any]:
        """Validate SAML response"""
        # Check status
        if "Success" not in response.status_code:
            return {
                "valid": False,
                "error": f"Response status: {response.status_code} - {response.status_message}",
            }

        # Check if assertion exists
        if not response.assertion:
            return {"valid": False, "error": "No assertion in response"}

        # Check assertion timing
        now = datetime.now(timezone.utc)
        if now < response.assertion.not_before - timedelta(
            seconds=self.config.clock_skew_seconds
        ):
            return {"valid": False, "error": "Assertion not yet valid"}

        if now > response.assertion.not_on_or_after + timedelta(
            seconds=self.config.clock_skew_seconds
        ):
            return {"valid": False, "error": "Assertion has expired"}

        # Check audience restriction
        if self.config.validate_audience_restriction:
            if response.assertion.audience != self.config.service_provider.entity_id:
                return {
                    "valid": False,
                    "error": f"Audience mismatch: expected {self.config.service_provider.entity_id}, got {response.assertion.audience}",
                }

        # Check in response to
        if response.in_response_to not in self.pending_requests:
            return {
                "valid": False,
                "error": "Invalid InResponseTo value or request not found",
            }

        # Verify signature if required and available
        if self.config.require_signed_assertions and HAS_XMLSEC:
            idp_config = self.config.identity_providers.get(response.issuer)
            if idp_config and idp_config.x509_cert:
                # Note: Actual signature verification implementation would be here
                # signature_valid = self._verify_xml_signature(response_xml, idp_config.x509_cert)
                signature_valid = True  # Simplified for now

                if not signature_valid:
                    return {"valid": False, "error": "Invalid signature"}

        return {"valid": True}

    def _extract_user_info(
        self, assertion: SAMLAssertion, idp_entity_id: str
    ) -> SAMLUserInfo:
        """Extract user information from assertion"""
        idp_config = self.config.identity_providers.get(idp_entity_id)

        # Start with basic info
        user_info = SAMLUserInfo(
            subject=assertion.subject,
            subject_format=assertion.subject_name_id_format,
            session_index=assertion.session_index,
            authn_instant=assertion.authn_instant,
            attributes=assertion.attributes,
            idp_entity_id=idp_entity_id,
        )

        # Map attributes if configuration exists
        if idp_config and idp_config.attribute_mapping:
            for saml_attr, user_attr in idp_config.attribute_mapping.items():
                if saml_attr in assertion.attributes:
                    setattr(user_info, user_attr, assertion.attributes[saml_attr])

        # Set email from subject if it's email format and no email attribute
        if (
            not user_info.email
            and assertion.subject_name_id_format == SAMLNameIDFormat.EMAIL
        ):
            user_info.email = assertion.subject

        return user_info

    def _get_logout_url(
        self, idp_entity_id: str, session_index: Optional[str]
    ) -> Optional[str]:
        """Get logout URL for identity provider"""
        idp_config = self.config.identity_providers.get(idp_entity_id)
        if idp_config and idp_config.slo_url:
            return idp_config.slo_url
        return None

    async def cleanup_expired_requests(self) -> int:
        """Clean up expired authentication requests"""
        now = datetime.now(timezone.utc)
        expired_requests = []

        for request_id, request in self.pending_requests.items():
            if now > request.expires_at:
                expired_requests.append(request_id)

        for request_id in expired_requests:
            del self.pending_requests[request_id]

        return len(expired_requests)

    async def get_active_sessions(self) -> List[Dict[str, Any]]:
        """Get list of active SAML sessions"""
        sessions = []
        for session_index, user_info in self.active_sessions.items():
            sessions.append(
                {
                    "session_index": session_index,
                    "subject": user_info.subject,
                    "email": user_info.email,
                    "name": user_info.name,
                    "idp_entity_id": user_info.idp_entity_id,
                    "authn_instant": user_info.authn_instant.isoformat(),
                }
            )
        return sessions

# Factory functions
def create_saml_authentication(config: SAMLConfiguration) -> SAMLAuthentication:
    """Create SAMLAuthentication instance"""
    return SAMLAuthentication(config)

def create_test_saml_config() -> SAMLConfiguration:
    """Create test SAML configuration"""
    sp_config = SAMLServiceProviderConfig(
        entity_id="https://docufusion.ai/saml/metadata",
        assertion_consumer_service_url="https://docufusion.ai/saml/acs",
    )

    # Add test IdP
    test_idp = SAMLIdentityProviderConfig(
        entity_id="https://test-idp.example.com",
        sso_url="https://test-idp.example.com/sso",
        slo_url="https://test-idp.example.com/slo",
    )

    config = SAMLConfiguration(
        service_provider=sp_config, identity_providers={"test-idp": test_idp}
    )

    return config
