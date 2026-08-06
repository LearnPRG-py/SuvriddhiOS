#include "python_handler.h"

#include <cstdlib>

#include "test_handler.h"

#include <filesystem>

#include <iostream>

#include <filesystem>

#include <iostream>

using json = nlohmann::json;

int HandlePython(struct mg_connection *conn, void *)
{
	json req = GetJsonReq(conn);
	if (!req.is_object() || !req.contains("code") || !req["code"].is_string()) {
		json res = { { "success", false },
			     { "input", nullptr },
			     { "expected", nullptr },
			     { "output", nullptr },
			     { "error", "A source-code string is required" } };
		SendResponse(conn, res.dump());
		return 200;
	}

	std::string code = req["code"];
	json tests = req.value("tests", json::array());
	std::string token = GenerateToken(16);
	std::string path = "/tmp/" + token + ".py";

	WriteFile(path, code);
	json res = RunTests(tests, token, Language::kPython);
	std::filesystem::remove(path);
	std::string token = GenerateToken(16);
	std::string path = "/tmp/" + token + ".py";

	WriteFile(path, code);
	json res = RunTests(tests, token, Language::kPython);
	std::filesystem::remove(path);
	SendResponse(conn, res.dump());


	return 200;
}
